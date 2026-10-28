import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import {
  refreshAccessToken,
  listInboxThreadIds,
  listThreadIdsForLabel,
  listLabels,
  getThreadDetails,
  gmailThreadUrl,
  GmailApiError,
  type GmailLabel,
  type GmailThread,
} from "@/lib/gmail";
import { extractDomain, type ApplicationPickerOption } from "@/lib/emailThreadsShared";
import { listContactsForUser } from "@/lib/contacts";
import { askJev, type JevQuestion } from "@/lib/jev";
import { APPLICATION_STATUSES, STATUS_DESCRIPTIONS, type ApplicationStatus } from "@/lib/applicationsShared";
import type { EmailThread } from "@prisma/client";

export type { ApplicationPickerOption } from "@/lib/emailThreadsShared";

export async function getValidAccessTokenForUser(userId: string): Promise<string> {
  const account = await prisma.gmailAccount.findUnique({ where: { userId } });
  if (!account) throw new GmailApiError("Gmail is not connected.");
  return refreshAccessToken(decrypt(account.encryptedRefreshToken));
}

/** Labels the user can pick as the manual triage-override (see syncLabelIds below). */
export async function listAvailableLabelsForUser(userId: string): Promise<GmailLabel[]> {
  const accessToken = await getValidAccessTokenForUser(userId);
  return listLabels(accessToken, userId);
}

/**
 * The manual override: any thread carrying one of these labels always gets
 * pulled into the sync and always stays eligible for triage, regardless of
 * Jev's recruiting classification or the INBOX_SCAN_LIMIT recency window.
 * Reuses GmailAccount.syncLabelIds (the old label-picker's column, unused
 * since sync moved to scanning the inbox itself) rather than a new column —
 * same storage, new meaning: "force include," not "scope sync to only
 * these."
 */
export async function updateSyncLabelsForUser(userId: string, labelIds: string[]): Promise<void> {
  await prisma.gmailAccount.update({ where: { userId }, data: { syncLabelIds: labelIds } });
}

type MatchCandidates = {
  contactsByEmail: Map<string, string>;
  applicationByDomain: Map<string, string>;
  applicationByContact: Map<string, string>;
};

async function loadMatchCandidates(userId: string): Promise<MatchCandidates> {
  const [contacts, companies, applicationContacts] = await Promise.all([
    prisma.contact.findMany({ where: { userId }, select: { id: true, emails: true } }),
    prisma.company.findMany({
      where: { userId },
      select: {
        id: true,
        website: true,
        applications: { select: { id: true }, orderBy: { updatedAt: "desc" }, take: 1 },
      },
    }),
    prisma.applicationContact.findMany({
      where: { userId },
      select: { contactId: true, application: { select: { id: true, updatedAt: true } } },
    }),
  ]);

  const contactsByEmail = new Map<string, string>();
  for (const c of contacts) {
    for (const email of c.emails) contactsByEmail.set(email.toLowerCase(), c.id);
  }

  const applicationByDomain = new Map<string, string>();
  for (const company of companies) {
    if (!company.website || company.applications.length === 0) continue;
    const domain = extractDomain(company.website);
    if (domain) applicationByDomain.set(domain, company.applications[0].id);
  }

  // A contact can be linked to more than one application (e.g. re-applying
  // next cycle); when picking one to push an email through to, prefer the
  // application that was touched most recently.
  const applicationByContact = new Map<string, { id: string; updatedAt: Date }>();
  for (const ac of applicationContacts) {
    const current = applicationByContact.get(ac.contactId);
    if (!current || ac.application.updatedAt > current.updatedAt) {
      applicationByContact.set(ac.contactId, ac.application);
    }
  }

  return {
    contactsByEmail,
    applicationByDomain,
    applicationByContact: new Map([...applicationByContact].map(([contactId, app]) => [contactId, app.id])),
  };
}

/**
 * Exact participant-email-to-contact match only; anything else is a
 * suggestion, never auto-linked (PLAN.md §4: "Auto-link only on exact
 * contact-email matches. Everything else goes to a triage queue").
 *
 * When a thread matches a contact who is already linked to an application
 * (via ApplicationContact — an explicit link the user made, not a guess),
 * that application link is pushed through onto the thread/interaction too,
 * taking priority over the weaker company-domain guess below.
 */
function matchThread(
  thread: GmailThread,
  candidates: MatchCandidates
): { contactId: string | null; applicationId: string | null; matchStatus: string } {
  let contactId: string | null = null;
  for (const email of thread.participants) {
    const match = candidates.contactsByEmail.get(email);
    if (match) {
      contactId = match;
      break;
    }
  }

  if (contactId) {
    const linkedApplicationId = candidates.applicationByContact.get(contactId);
    if (linkedApplicationId) {
      return { contactId, applicationId: linkedApplicationId, matchStatus: "auto" };
    }
  }

  let applicationId: string | null = null;
  for (const email of thread.participants) {
    const domain = email.split("@")[1];
    const match = domain && candidates.applicationByDomain.get(domain);
    if (match) {
      applicationId = match;
      break;
    }
  }

  return { contactId, applicationId, matchStatus: contactId ? "auto" : "unmatched" };
}

/**
 * Mirrors a confirmed/auto match onto the contact's or application's
 * interaction timeline. No-ops if already created (idempotent across
 * resyncs) — an atomic upsert on the (userId, emailThreadId) unique
 * constraint rather than a separate findFirst-then-create, so two syncs
 * racing on the same thread can't both pass a "not found yet" check and
 * double-insert.
 */
async function createInteractionFromEmailThreadIfMissing(
  userId: string,
  emailThread: Pick<EmailThread, "id" | "subject" | "snippet" | "lastMessageAt">,
  contactId: string | null,
  applicationId: string | null
): Promise<void> {
  if (!contactId && !applicationId) return;

  await prisma.interaction.upsert({
    where: { userId_emailThreadId: { userId, emailThreadId: emailThread.id } },
    update: {}, // already exists — leave it as-is, don't overwrite a user-edited summary/timestamp
    create: {
      type: "Email",
      occurredAt: emailThread.lastMessageAt ?? new Date(),
      summary: emailThread.subject || emailThread.snippet || "Email thread",
      contactId,
      applicationId,
      emailThreadId: emailThread.id,
      userId,
    },
  });
}

/**
 * Re-checks already-synced-but-unmatched threads against the current
 * contact/company list, using data already stored on EmailThread — no Gmail
 * API call needed. Without this, a thread that didn't match on its first
 * sync could never match later: the History API only returns threads with
 * *new* Gmail activity, so a contact added after the fact would never
 * trigger a re-look at a thread with no new messages.
 *
 * Also backfills the application link on threads that already auto/confirmed-
 * matched a contact but have no applicationId yet — covers a contact being
 * linked to an application (ApplicationContact) *after* their email already
 * synced, which would otherwise never push through to that application.
 */
async function rematchUnmatchedThreadsForUser(userId: string, candidates: MatchCandidates): Promise<number> {
  // A thread can lose both its contact and application link (e.g. the matched
  // Contact or Application was deleted — EmailThread.matchedContactId/
  // matchedApplicationId are onDelete: SetNull) while its matchStatus stays
  // "auto"/"confirmed". Left alone, that thread is stuck forever: it's not
  // "unmatched" so it never shows in Triage, and it's not "ignored" so it
  // never shows there either — and the loop below only re-evaluates
  // "unmatched" threads. Demote it back to "unmatched" so it resurfaces for a
  // fresh manual match.
  const { count: resurfaced } = await prisma.emailThread.updateMany({
    where: { userId, matchStatus: { in: ["auto", "confirmed"] }, matchedContactId: null, matchedApplicationId: null },
    data: { matchStatus: "unmatched" },
  });

  const [unmatched, missingApplicationLink] = await Promise.all([
    prisma.emailThread.findMany({ where: { userId, matchStatus: "unmatched" } }),
    prisma.emailThread.findMany({
      where: { userId, matchStatus: { in: ["auto", "confirmed"] }, matchedApplicationId: null, matchedContactId: { not: null } },
    }),
  ]);
  let rematched = resurfaced;

  for (const thread of missingApplicationLink) {
    const applicationId = thread.matchedContactId ? candidates.applicationByContact.get(thread.matchedContactId) : undefined;
    if (!applicationId) continue;

    await prisma.emailThread.updateMany({ where: { id: thread.id, userId }, data: { matchedApplicationId: applicationId } });
    await prisma.interaction.updateMany({
      where: { emailThreadId: thread.id, userId, applicationId: null },
      data: { applicationId },
    });
    rematched++;
  }

  for (const thread of unmatched) {
    const match = matchThread(
      { id: thread.gmailThreadId, subject: thread.subject, snippet: thread.snippet, participants: thread.participants, lastMessageAt: thread.lastMessageAt ?? new Date() },
      candidates
    );
    if (match.matchStatus !== "auto" && match.applicationId === thread.matchedApplicationId) {
      continue; // nothing new to persist — still unmatched, same (or no) suggested application
    }

    await prisma.emailThread.updateMany({
      where: { id: thread.id, userId },
      data: { matchedContactId: match.contactId, matchedApplicationId: match.applicationId, matchStatus: match.matchStatus },
    });
    rematched++;

    if (match.matchStatus === "auto") {
      await createInteractionFromEmailThreadIfMissing(userId, thread, match.contactId, match.applicationId);
    }
  }

  return rematched;
}

export type SyncResult =
  | { ok: true; threadsUpserted: number; rematched: number }
  | { ok: false; error: string };

// Lowered from 8: with up to ~1500 threads in a single sync (the 1000-thread
// inbox cap plus however many carry the override label) each costing a
// Gmail API call, high concurrency burns through Gmail's per-user-per-
// minute quota fast enough to trip "Quota exceeded... Units per minute per
// user" (seen in production). Spreading the same calls out over more wall-
// clock time, rather than bursting them, is what actually avoids that —
// gmailFetch's retry-with-backoff (gmail.ts) is the backstop for whatever
// still gets rate-limited despite this.
const THREAD_SYNC_CONCURRENCY = 3;

// Runs `fn` over `items` with at most `limit` in flight at once. Each thread
// below is fetched/classified/upserted independently (keyed by its own
// userId+gmailThreadId), so this is safe to parallelize instead of
// processing the whole inbox scan one thread at a time.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
  signal?: AbortSignal
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    for (;;) {
      if (signal?.aborted) return;
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const COMMON_WEBMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "protonmail.com", "live.com", "me.com",
]);

/** A rough "this looks like the company, not a personal/webmail address" guess from a thread's participants — used only as a prefill the user can edit, never auto-applied. */
function guessCompanyNameFromParticipants(participants: string[]): string | null {
  for (const email of participants) {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain || COMMON_WEBMAIL_DOMAINS.has(domain)) continue;
    const name = domain.split(".")[0];
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : null;
  }
  return null;
}

const SUBJECT_SPLIT_RE = /[-|:•]/;

/** Candidate role-title substrings from a subject line (e.g. "Your application to Acme — Software Engineer"), for Jev to disambiguate — never generated, only chosen from. */
function subjectRoleCandidates(subject: string | null): string[] {
  if (!subject) return [];
  const parts = subject.split(SUBJECT_SPLIT_RE).map((s) => s.trim()).filter((s) => s.length > 2);
  return [...new Set(parts)];
}

type ThreadClassification = {
  recruitingLikely: boolean | null;
  recruitingConfidence: number | null;
  suggestedContactId: string | null;
  suggestedContactConf: number | null;
  suggestedApplicationId: string | null;
  suggestedApplicationConf: number | null;
  suggestedNewCompany: string | null;
  suggestedNewRole: string | null;
  suggestedStatus: string | null;
  suggestedStatusConf: number | null;
};

const EMPTY_CLASSIFICATION: ThreadClassification = {
  recruitingLikely: null,
  recruitingConfidence: null,
  suggestedContactId: null,
  suggestedContactConf: null,
  suggestedApplicationId: null,
  suggestedApplicationConf: null,
  suggestedNewCompany: null,
  suggestedNewRole: null,
  suggestedStatus: null,
  suggestedStatusConf: null,
};

/**
 * Eager, per-thread Jev classification run during sync (see CLAUDE.md "AI
 * Features (Jev)" — this is the one deliberate exception to "on-demand
 * only, bounded cost" every other Jev feature here keeps to). Only called
 * for threads whose content is new or changed since the last classification
 * pass (see the `needsJevPass` check in syncGmailForUser) — not re-run on
 * every sync click.
 *
 * `knownApplicationId`/`knownApplicationStatus` are set when the thread
 * already has a resolved application (an exact contact-email match, or a
 * contact/application Jev already suggested on a prior pass) — in that case
 * this only asks the status question, skipping the recruiting/match
 * questions entirely (a known match is already high-confidence).
 */
async function classifyThreadForTriage(
  thread: Pick<GmailThread, "id" | "subject" | "snippet" | "participants">,
  bodyText: string,
  contactCandidates: { id: string; name: string; title: string | null; company: { name: string } | null }[],
  applicationCandidates: ApplicationPickerOption[],
  knownApplicationId: string | null,
  knownApplicationStatus: string | null
): Promise<ThreadClassification> {
  const state = [
    thread.subject ? `Subject: ${thread.subject}` : null,
    thread.snippet ? `Snippet: ${thread.snippet}` : null,
    bodyText ? `Body:\n${bodyText}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result: ThreadClassification = { ...EMPTY_CLASSIFICATION };

  if (knownApplicationId) {
    // Already matched — only worth asking whether this specific email
    // suggests a status change (e.g. a rejection for an app marked Applied).
    const statusResult = await askJev(state, {
      status: {
        type: "choice",
        instructions: "Based on this email, what is the most likely current status of this job application?",
        criteria: Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, STATUS_DESCRIPTIONS[s]])),
      },
    });
    if (statusResult.ok) {
      const answer = statusResult.answers.status;
      if (answer.type === "choice") {
        const suggested = APPLICATION_STATUSES.includes(answer.choice as ApplicationStatus) ? answer.choice : null;
        if (suggested && suggested !== knownApplicationStatus) {
          result.suggestedStatus = suggested;
          result.suggestedStatusConf = answer.confidence;
        }
      }
    }
    return result;
  }

  const questions: Record<string, JevQuestion> = {
    recruiting: {
      type: "noul",
      instructions:
        "Is this a personal email specifically about a job application the recipient has submitted, or a specific recruiter/hiring contact reaching out to the recipient (e.g. an application confirmation, interview scheduling, a rejection, an offer, direct recruiter outreach)? " +
        "Answer no for anything automated or bulk, even if it mentions jobs or hiring: job-board/platform digests and alerts listing job openings or recommendations (e.g. LinkedIn job alerts, Jobright, Indeed, ZipRecruiter, Glassdoor, 'jobs you may be interested in' emails), newsletters, receipts, and other mass notifications are not personal correspondence about the recipient's own candidacy and should be answered no.",
    },
  };
  if (contactCandidates.length > 0) {
    questions.contact = {
      type: "choice",
      instructions: "Which contact is this email thread most likely associated with?",
      criteria: {
        none: "None of these contacts",
        ...Object.fromEntries(
          contactCandidates.map((c) => [c.id, [c.name, c.title, c.company?.name].filter(Boolean).join(" — ")])
        ),
      },
    };
  }
  if (applicationCandidates.length > 0) {
    questions.application = {
      type: "choice",
      instructions: "Which job application is this email thread most likely associated with?",
      criteria: {
        none: "None of these applications",
        ...Object.fromEntries(
          applicationCandidates.map((a) => [a.id, `${a.companyName} — ${a.roleTitle} (${a.status})`])
        ),
      },
    };
  }

  const classifyResult = await askJev(state, questions);
  if (!classifyResult.ok) return result;

  const recruitingAnswer = classifyResult.answers.recruiting;
  if (recruitingAnswer?.type === "noul") {
    result.recruitingLikely = recruitingAnswer.noul > 0.5;
    result.recruitingConfidence = recruitingAnswer.noul;
  }

  const contactAnswer = classifyResult.answers.contact;
  if (contactAnswer?.type === "choice" && contactAnswer.choice !== "none") {
    result.suggestedContactId = contactAnswer.choice;
    result.suggestedContactConf = contactAnswer.confidence;
  }
  const applicationAnswer = classifyResult.answers.application;
  if (applicationAnswer?.type === "choice" && applicationAnswer.choice !== "none") {
    result.suggestedApplicationId = applicationAnswer.choice;
    result.suggestedApplicationConf = applicationAnswer.confidence;
  }

  // Recruiting-related but didn't match anything we're already tracking —
  // might be a brand-new opportunity. Guess a company (deterministic, from
  // the sender's domain) and a role (deterministic candidates from the
  // subject line, Jev only disambiguates between them — never generates).
  if (result.recruitingLikely && !result.suggestedApplicationId) {
    result.suggestedNewCompany = guessCompanyNameFromParticipants(thread.participants);
    const roleCandidates = subjectRoleCandidates(thread.subject);
    if (roleCandidates.length === 1) {
      result.suggestedNewRole = roleCandidates[0];
    } else if (roleCandidates.length >= 2) {
      const roleResult = await askJev(state, {
        role: {
          type: "choice",
          instructions: "Which of these is most likely the job role/title this recruiting email is about?",
          criteria: Object.fromEntries(roleCandidates.map((c) => [c, c])),
        },
      });
      if (roleResult.ok) {
        const roleAnswer = roleResult.answers.role;
        if (roleAnswer.type === "choice" && roleCandidates.includes(roleAnswer.choice)) {
          result.suggestedNewRole = roleAnswer.choice;
        }
      }
    }
  }

  return result;
}

/**
 * Manual "Sync now". Scans the inbox — read and unread, regardless of label
 * (see gmail.ts's listInboxThreadIds). The *first* sync for an account (no
 * lastSyncAt yet) scans the whole inbox, capped at INBOX_SCAN_LIMIT (1000)
 * most recently active threads. Every sync after that is incremental:
 * scoped to `after:<lastSyncAt minus a buffer>` instead of re-fetching
 * every thread's full details again regardless of whether anything about
 * it changed — the earlier design re-scanned everything on every sync,
 * which made a resync cost the same as the first sync every time (what
 * made a ~500-thread inbox take ~10 minutes to resync in practice, even
 * when almost nothing had changed). The 1000-thread cap still applies to
 * the incremental case as a safety ceiling; it should rarely if ever
 * actually bind there, since "new activity since the last sync" is
 * normally far smaller than the whole inbox.
 *
 * For each thread, eagerly runs Jev classification (see
 * classifyThreadForTriage) so the triage queue arrives pre-filled with
 * "likely recruiting-related", a guessed job/contact, or a suggested status
 * change — the one deliberate exception to every other Jev feature's
 * on-demand-only, bounded-cost design (see CLAUDE.md "AI Features (Jev)").
 * Classification only re-runs for a thread when it's new or has new
 * activity since the last pass, not on every sync click.
 *
 * This is the least-proven part of the whole tracker (see
 * docs/MIGRATION_PLAN.md §6 risk 3) and has not been exercised against a
 * live Gmail account — verify manually before relying on it.
 */
export async function syncGmailForUser(
  userId: string,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal
): Promise<SyncResult> {
  const account = await prisma.gmailAccount.findUnique({ where: { userId } });
  if (!account) return { ok: false, error: "Gmail is not connected." };

  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(decrypt(account.encryptedRefreshToken));
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to refresh Gmail access." };
  }

  const candidates = await loadMatchCandidates(userId);
  const rematched = await rematchUnmatchedThreadsForUser(userId, candidates);

  // Full candidate lists for Jev's match-guess choice questions, fetched
  // once up front rather than per-thread — same cap/rationale as
  // suggestMatchForThreadForUser's on-demand version.
  const [contactChoices, applicationChoices] = await Promise.all([
    listContactsForUser(userId),
    listApplicationPickerOptionsForUser(userId),
  ]);
  const contactCandidates = contactChoices.slice(0, MAX_SUGGESTION_CANDIDATES);
  const applicationCandidates = applicationChoices.slice(0, MAX_SUGGESTION_CANDIDATES);
  const applicationStatusById = new Map(applicationChoices.map((a) => [a.id, a.status]));

  // Incremental resync: once there's a prior successful sync to anchor to,
  // only ask Gmail for threads with activity since then, rather than
  // re-fetching every thread's full details again regardless of whether
  // anything about it changed (what made every sync as expensive as the
  // first one). The buffer subtracted from lastSyncAt — not lastSyncAt
  // exactly — covers a message arriving *during* the previous sync's own
  // run: that message's date is before the run's completion timestamp
  // (lastSyncAt), so a bare "since lastSyncAt" cutoff would miss it
  // forever. The buffer just needs to comfortably exceed how long a sync
  // actually takes; re-covering a few already-processed threads at the
  // edges is harmless (needsJevPass still skips reclassifying anything
  // that hasn't changed; the upsert is idempotent either way).
  const RESYNC_OVERLAP_BUFFER_MS = 15 * 60 * 1000;
  const sinceEpochSeconds = account.lastSyncAt
    ? Math.floor((account.lastSyncAt.getTime() - RESYNC_OVERLAP_BUFFER_MS) / 1000)
    : undefined;

  let threadIds: string[];
  try {
    threadIds = await listInboxThreadIds(accessToken, userId, sinceEpochSeconds);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to list Gmail messages." };
  }

  // Manual override: any thread carrying one of the user's chosen labels is
  // pulled in and marked labelForced regardless of whether it's within the
  // INBOX_SCAN_LIMIT recency window — a label a user applies to an older
  // thread should still reach triage. Recomputed fresh every sync (see
  // labelForced's own schema comment) rather than failing the whole sync if
  // one label lookup errors.
  const threadIdSet = new Set(threadIds);
  const labelForcedThreadIds = new Set<string>();
  for (const labelId of account.syncLabelIds) {
    try {
      const ids = await listThreadIdsForLabel(accessToken, userId, labelId);
      for (const id of ids) {
        labelForcedThreadIds.add(id);
        threadIdSet.add(id);
      }
    } catch {
      // Skip a label that fails to look up rather than aborting the sync —
      // same philosophy as "skip threads that fail to fetch" below.
    }
  }
  threadIds = [...threadIdSet];
  onProgress?.(0, threadIds.length);

  let upserted = 0;
  let processed = 0;
  await mapWithConcurrency(
    threadIds,
    THREAD_SYNC_CONCURRENCY,
    async (gmailThreadId) => {
      try {
        await processThread(gmailThreadId);
      } finally {
        processed++;
        onProgress?.(processed, threadIds.length);
      }
    },
    signal
  );

  async function processThread(gmailThreadId: string): Promise<void> {
    let gmailThread: GmailThread;
    let bodyText: string;
    try {
      ({ thread: gmailThread, bodyText } = await getThreadDetails(accessToken, userId, gmailThreadId));
    } catch {
      return; // skip threads that fail to fetch rather than aborting the whole sync
    }

    const existing = await prisma.emailThread.findUnique({
      where: { userId_gmailThreadId: { userId, gmailThreadId: gmailThread.id } },
    });

    // Preserve a user's own triage decision (confirmed/ignored) across resyncs.
    const match =
      existing && existing.matchStatus !== "unmatched"
        ? { contactId: existing.matchedContactId, applicationId: existing.matchedApplicationId, matchStatus: existing.matchStatus }
        : matchThread(gmailThread, candidates);

    const needsJevPass =
      !existing?.jevClassifiedAt || (gmailThread.lastMessageAt && gmailThread.lastMessageAt > existing.jevClassifiedAt);

    let classification: ThreadClassification = EMPTY_CLASSIFICATION;
    if (needsJevPass) {
      // An exact contact match, or a Jev suggestion already on record from a
      // prior pass, both count as "already resolved" — skip re-asking which
      // job/contact and go straight to the status question.
      const knownApplicationId = match.applicationId ?? existing?.jevSuggestedApplicationId ?? null;
      classification = await classifyThreadForTriage(
        gmailThread,
        bodyText,
        contactCandidates,
        applicationCandidates,
        knownApplicationId,
        knownApplicationId ? applicationStatusById.get(knownApplicationId) ?? null : null
      );
    }

    const emailThreadRow = await prisma.emailThread.upsert({
      where: { userId_gmailThreadId: { userId, gmailThreadId: gmailThread.id } },
      create: {
        gmailThreadId: gmailThread.id,
        subject: gmailThread.subject,
        snippet: gmailThread.snippet,
        participants: gmailThread.participants,
        lastMessageAt: gmailThread.lastMessageAt,
        gmailUrl: gmailThreadUrl(gmailThread.id),
        matchedContactId: match.contactId,
        matchedApplicationId: match.applicationId,
        matchStatus: match.matchStatus,
        labelForced: labelForcedThreadIds.has(gmailThreadId),
        userId,
        ...(needsJevPass
          ? {
              jevRecruitingLikely: classification.recruitingLikely,
              jevRecruitingConfidence: classification.recruitingConfidence,
              jevSuggestedContactId: classification.suggestedContactId,
              jevSuggestedContactConf: classification.suggestedContactConf,
              jevSuggestedApplicationId: classification.suggestedApplicationId,
              jevSuggestedApplicationConf: classification.suggestedApplicationConf,
              jevSuggestedNewCompany: classification.suggestedNewCompany,
              jevSuggestedNewRole: classification.suggestedNewRole,
              jevSuggestedStatus: classification.suggestedStatus,
              jevSuggestedStatusConf: classification.suggestedStatusConf,
              jevClassifiedAt: new Date(),
            }
          : {}),
      },
      update: {
        subject: gmailThread.subject,
        snippet: gmailThread.snippet,
        participants: gmailThread.participants,
        lastMessageAt: gmailThread.lastMessageAt,
        matchedContactId: match.contactId,
        matchedApplicationId: match.applicationId,
        matchStatus: match.matchStatus,
        labelForced: labelForcedThreadIds.has(gmailThreadId),
        ...(needsJevPass
          ? {
              jevRecruitingLikely: classification.recruitingLikely,
              jevRecruitingConfidence: classification.recruitingConfidence,
              jevSuggestedContactId: classification.suggestedContactId,
              jevSuggestedContactConf: classification.suggestedContactConf,
              jevSuggestedApplicationId: classification.suggestedApplicationId,
              jevSuggestedApplicationConf: classification.suggestedApplicationConf,
              jevSuggestedNewCompany: classification.suggestedNewCompany,
              jevSuggestedNewRole: classification.suggestedNewRole,
              jevSuggestedStatus: classification.suggestedStatus,
              jevSuggestedStatusConf: classification.suggestedStatusConf,
              jevClassifiedAt: new Date(),
            }
          : {}),
      },
    });
    upserted++;

    if (match.matchStatus === "auto") {
      await createInteractionFromEmailThreadIfMissing(userId, emailThreadRow, match.contactId, match.applicationId);
    }
  }

  // A cancelled sync stopped early (mapWithConcurrency's workers saw the
  // abort signal and quit picking up new threads) — don't advance
  // lastSyncAt, or the next incremental resync would anchor to "now" and
  // silently skip every thread this run never got to.
  if (signal?.aborted) {
    return { ok: false, error: "Sync cancelled." };
  }

  await prisma.gmailAccount.update({
    where: { userId },
    data: { lastSyncAt: new Date() },
  });

  return { ok: true, threadsUpserted: upserted, rematched };
}

// Atomically claims the "running" slot — returns false if a sync (manual or
// cron) is already in progress for this account, so two triggers can never
// race each other or double up on Gmail API calls.
// How long a "running" status is trusted before a new sync attempt is
// allowed to reclaim it as abandoned. Needed because nothing ever clears
// syncStatus if the process dies mid-sync (a deploy, a crash, a container
// restart) — fire-and-forget work has no "this got interrupted" signal of
// its own, so without this a single bad restart would permanently lock
// that user out of syncing again, with no self-healing path and a
// perpetually disabled "Sync now" button (see getGmailSyncStatusForUser,
// which surfaces this same staleness so the UI re-enables the button
// instead of showing "Syncing…" forever). Generous relative to the
// realistic sync times seen so far (minutes, not tens of minutes) so a
// second attempt never preempts a merely-slow-but-healthy sync.
const STALE_SYNC_THRESHOLD_MS = 20 * 60 * 1000;

function isStale(syncStartedAt: Date | null): boolean {
  return !!syncStartedAt && Date.now() - syncStartedAt.getTime() > STALE_SYNC_THRESHOLD_MS;
}

// Returns the exact syncStartedAt this call claimed (null if it couldn't
// claim the slot) — finalizeSyncStatus below uses that same value as an
// optimistic-lock token, so a run that's no longer the "current" one for
// this account (superseded by a cancellation or a later reclaim) can't
// clobber whatever happened after it.
async function markSyncRunningForUser(userId: string): Promise<Date | null> {
  const staleCutoff = new Date(Date.now() - STALE_SYNC_THRESHOLD_MS);
  const startedAt = new Date();
  const { count } = await prisma.gmailAccount.updateMany({
    where: {
      userId,
      OR: [{ syncStatus: { not: "running" } }, { syncStatus: "running", syncStartedAt: { lt: staleCutoff } }],
    },
    data: { syncStatus: "running", syncStartedAt: startedAt, syncTotal: null, syncDone: 0, syncError: null },
  });
  return count > 0 ? startedAt : null;
}

// In-memory registry of the AbortController backing each account's
// currently-running sync, so cancelStuckSyncForUser below can actually stop
// it instead of just editing DB bookkeeping while the real work keeps going
// — the previous version of "Cancel" only reset syncStatus, leaving the
// un-awaited syncGmailForUser call running regardless, which let Cancel +
// Sync-now effectively start a second real sync for the same account while
// the first was still alive. Scoped to this process: in the single
// long-running Node process this app deploys as (see CLAUDE.md "Deployment"),
// that's the only place a sync can actually be running, so this is
// sufficient — it doesn't need to reach across processes/instances.
const activeSyncControllers = new Map<string, AbortController>();

function registerActiveSync(userId: string): AbortController {
  const controller = new AbortController();
  activeSyncControllers.set(userId, controller);
  return controller;
}

function unregisterActiveSync(userId: string, controller: AbortController): void {
  // Only clear this account's entry if it's still *this* run's controller —
  // a fresh sync claimed via markSyncRunningForUser after this one finished
  // (or was cancelled) would already have overwritten it with its own.
  if (activeSyncControllers.get(userId) === controller) {
    activeSyncControllers.delete(userId);
  }
}

async function finalizeSyncStatus(userId: string, claimedAt: Date, result: SyncResult | null, error?: string): Promise<void> {
  const message = error ?? (result && !result.ok ? result.error : undefined);
  await prisma.gmailAccount
    .updateMany({
      // Only apply if this is still the run `claimedAt` identifies — if a
      // manual cancel or a later reclaim has since changed syncStartedAt,
      // this is a zombie finishing late and must not overwrite whatever
      // superseded it.
      where: { userId, syncStartedAt: claimedAt },
      data: message ? { syncStatus: "error", syncError: message } : { syncStatus: "idle", syncError: null },
    })
    .catch(() => {
      // Best-effort — if this write fails, getGmailSyncStatusForUser will
      // keep reporting "running" until the next sync attempt overwrites it,
      // which is a stale-but-safe failure mode, not a crash.
    });
}

/**
 * Manual override for a sync that appears stuck or crashed, without
 * waiting for markSyncRunningForUser's STALE_SYNC_THRESHOLD_MS (20 min) to
 * let a new attempt reclaim it automatically — the "Cancel" control next
 * to the progress bar in GmailConnectionPanel.tsx while a sync is running.
 * Clears syncStartedAt (not just syncStatus) so that if the process
 * wasn't actually dead — just slow — its eventual finalizeSyncStatus call
 * no longer matches this row's syncStartedAt and silently overwrites
 * whatever happens next (this cancellation, or a fresh sync started right
 * after it). No staleness check here on purpose: the user is the one
 * asserting "this is stuck," not a timer guessing at it.
 */
export async function cancelStuckSyncForUser(userId: string): Promise<{ cancelled: boolean }> {
  // Actually stop the run if it's alive in this process — see
  // activeSyncControllers above. If it isn't (the process that started it
  // died, which is the original "stuck" case this control was built for),
  // this is a no-op and the DB reset below is all that's needed.
  activeSyncControllers.get(userId)?.abort();

  const { count } = await prisma.gmailAccount.updateMany({
    where: { userId, syncStatus: "running" },
    // Also clear syncTotal/syncDone (not just status/error) so the "Checked
    // N thread(s) on the last sync" summary doesn't render the cancelled
    // run's partial, in-progress counts as if they were a completed sync's.
    data: { syncStatus: "idle", syncStartedAt: null, syncError: null, syncTotal: null, syncDone: null },
  });
  return { cancelled: count > 0 };
}

// claimedAt is the same optimistic-lock token finalizeSyncStatus uses: a run
// superseded by a cancel or a later reclaim stops matching this row (its
// syncStartedAt no longer equals claimedAt) and its progress writes become
// no-ops instead of racing with whatever run replaced it.
function trackSyncProgress(userId: string, claimedAt: Date): (done: number, total: number) => void {
  return (done, total) => {
    void prisma.gmailAccount
      .updateMany({ where: { userId, syncStartedAt: claimedAt }, data: { syncDone: done, syncTotal: total } })
      .catch(() => {});
  };
}

/**
 * Awaited, synchronous sync — for callers that want the final result
 * directly rather than polling (the cron job, and MCP's sync_gmail_now,
 * both of which aren't subject to a browser's own request-timeout
 * constraints the way "Sync now" is). Guards against overlapping with a
 * concurrent sync via the same syncStatus field startGmailSyncInBackgroundForUser
 * (below) uses.
 */
export async function runTrackedGmailSyncForUser(userId: string): Promise<SyncResult> {
  const account = await prisma.gmailAccount.findUnique({ where: { userId } });
  if (!account) return { ok: false, error: "Gmail is not connected." };
  const claimedAt = await markSyncRunningForUser(userId);
  if (!claimedAt) {
    return { ok: false, error: "A sync is already in progress for this account." };
  }

  const controller = registerActiveSync(userId);
  const startedAt = Date.now();
  try {
    const result = await syncGmailForUser(userId, trackSyncProgress(userId, claimedAt), controller.signal);
    await finalizeSyncStatus(userId, claimedAt, result);
    console.log(`[gmail-sync] userId=${userId} ok=${result.ok} durationMs=${Date.now() - startedAt}`);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed unexpectedly.";
    await finalizeSyncStatus(userId, claimedAt, null, message);
    console.log(`[gmail-sync] userId=${userId} ok=false durationMs=${Date.now() - startedAt} error=${message}`);
    return { ok: false, error: message };
  } finally {
    unregisterActiveSync(userId, controller);
  }
}

/**
 * Fire-and-forget sync — for the browser's "Sync now" button. Returns as
 * soon as the sync has been *claimed and started*, not when it finishes:
 * a sync over hundreds of threads can run for minutes, far longer than a
 * single request/response (and any reverse proxy in front of it) should be
 * expected to survive. The client polls getGmailSyncStatusForUser instead
 * of awaiting this call directly. The un-awaited syncGmailForUser call
 * below keeps running after this function returns because this is a
 * long-running Node process (Docker + `node server.js`, not a short-lived
 * serverless function) — the event loop keeps it alive regardless of
 * whether the HTTP response that triggered it has already been sent.
 */
export async function startGmailSyncInBackgroundForUser(userId: string): Promise<{ started: boolean; error?: string }> {
  const account = await prisma.gmailAccount.findUnique({ where: { userId } });
  if (!account) return { started: false, error: "Gmail is not connected." };
  const claimedAt = await markSyncRunningForUser(userId);
  if (!claimedAt) {
    return { started: false, error: "A sync is already in progress." };
  }

  const controller = registerActiveSync(userId);
  const startedAt = Date.now();
  void syncGmailForUser(userId, trackSyncProgress(userId, claimedAt), controller.signal)
    .then((result) => {
      console.log(`[gmail-sync] userId=${userId} ok=${result.ok} durationMs=${Date.now() - startedAt}`);
      return finalizeSyncStatus(userId, claimedAt, result);
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : "Sync failed unexpectedly.";
      console.log(`[gmail-sync] userId=${userId} ok=false durationMs=${Date.now() - startedAt} error=${message}`);
      return finalizeSyncStatus(userId, claimedAt, null, message);
    })
    .finally(() => unregisterActiveSync(userId, controller));

  return { started: true };
}

export type GmailSyncStatus = {
  status: "idle" | "running" | "error";
  startedAt: Date | null;
  total: number | null;
  done: number | null;
  error: string | null;
  lastSyncAt: Date | null;
};

/** Polled by the browser while a background sync (started above) is running, to drive the progress UI and know when to refresh. */
export async function getGmailSyncStatusForUser(userId: string): Promise<GmailSyncStatus> {
  const account = await prisma.gmailAccount.findUnique({
    where: { userId },
    select: { syncStatus: true, syncStartedAt: true, syncTotal: true, syncDone: true, syncError: true, lastSyncAt: true },
  });
  if (!account) {
    return { status: "idle", startedAt: null, total: null, done: null, error: null, lastSyncAt: null };
  }

  // A "running" status past STALE_SYNC_THRESHOLD_MS means the process that
  // was running it is gone (crashed/redeployed/restarted) without ever
  // reaching finalizeSyncStatus — nothing else clears this on its own.
  // markSyncRunningForUser already lets a *new* sync attempt reclaim a
  // stale slot, but that's not enough by itself: GmailConnectionPanel
  // disables "Sync now" while status === "running", so without correcting
  // what's reported here too, the button would stay disabled forever with
  // no click ever reaching that reclaim logic. Persist the correction (not
  // just report it) so every reader — this one, another open tab, the next
  // markSyncRunningForUser check — sees the same resolved state.
  if (account.syncStatus === "running" && isStale(account.syncStartedAt)) {
    const message = "Sync appears to have stopped unexpectedly (the server may have restarted mid-sync) — try again.";
    await prisma.gmailAccount.update({ where: { userId }, data: { syncStatus: "error", syncError: message } }).catch(() => {});
    return {
      status: "error",
      startedAt: account.syncStartedAt,
      total: account.syncTotal,
      done: account.syncDone,
      error: message,
      lastSyncAt: account.lastSyncAt,
    };
  }

  return {
    status: (account.syncStatus as GmailSyncStatus["status"]) || "idle",
    startedAt: account.syncStartedAt,
    total: account.syncTotal,
    done: account.syncDone,
    error: account.syncError,
    lastSyncAt: account.lastSyncAt,
  };
}

/**
 * Richer-than-`listApplicationOptionsForUser` application list for the
 * triage picker (src/components/gmail/ApplicationPicker.tsx) — includes
 * company domain and status so the client-side ranking helpers in
 * emailThreadsShared.ts can surface the most plausible match first instead
 * of a flat alphabetical/unordered dropdown of every application.
 */
export async function listApplicationPickerOptionsForUser(userId: string): Promise<ApplicationPickerOption[]> {
  const applications = await prisma.application.findMany({
    where: { userId },
    select: {
      id: true,
      roleTitle: true,
      status: true,
      updatedAt: true,
      company: { select: { name: true, website: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return applications.map((a) => ({
    id: a.id,
    roleTitle: a.roleTitle,
    companyName: a.company.name,
    companyDomain: a.company.website ? extractDomain(a.company.website) : null,
    status: a.status,
    updatedAt: a.updatedAt,
  }));
}

export type EmailSyncStats = {
  connected: boolean;
  lastSyncAt: Date | null;
  needsReview: number;
  matched: number; // auto + confirmed
  total: number;
};

/**
 * Unmatched threads worth a human look — excludes anything Jev explicitly
 * classified as not recruiting-related, since the inbox scan (see "Gmail
 * sync" in CLAUDE.md) covers the whole inbox now, not just a curated label,
 * and without this filter every newsletter/receipt/personal email that
 * doesn't exactly match a contact would flood this list too. Explicitly
 * listed as true/null/labelForced (not `not: false`) to stay null-safe —
 * `jevRecruitingLikely: { not: false }` would silently exclude NULL rows
 * under SQL's three-valued logic, which is the opposite of "fail open."
 * null covers not-yet-classified or Jev-unavailable threads (never hide a
 * thread just because classification didn't run); labelForced always wins
 * regardless of what Jev concluded — see GmailAccount.syncLabelIds.
 *
 * Shared by listTriageThreadsForUser (the actual queue) and
 * getEmailSyncStatsForUser (the dashboard's "needs review" count) so the
 * two never disagree about what counts as needing review.
 */
function needsReviewWhere(userId: string) {
  return {
    userId,
    matchStatus: "unmatched" as const,
    OR: [{ jevRecruitingLikely: true }, { jevRecruitingLikely: null }, { labelForced: true }],
  };
}

/** Powers the dashboard Statistics panel's email-sync tiles. */
export async function getEmailSyncStatsForUser(userId: string): Promise<EmailSyncStats> {
  const [account, grouped, needsReview] = await Promise.all([
    prisma.gmailAccount.findUnique({ where: { userId }, select: { lastSyncAt: true } }),
    prisma.emailThread.groupBy({ by: ["matchStatus"], where: { userId }, _count: true }),
    prisma.emailThread.count({ where: needsReviewWhere(userId) }),
  ]);

  let matched = 0;
  let total = 0;
  for (const { matchStatus, _count } of grouped) {
    total += _count;
    if (matchStatus === "auto" || matchStatus === "confirmed") matched += _count;
  }

  return { connected: !!account, lastSyncAt: account?.lastSyncAt ?? null, needsReview, matched, total };
}

/**
 * Debug/reset tool: deletes every unmatched EmailThread row so the next
 * sync re-fetches and re-classifies them from scratch, for testing the
 * resync path in isolation from whatever state a prior sync left behind.
 * Scoped to matchStatus: "unmatched" only — auto/confirmed/ignored rows
 * represent either Jev's confirmed matches or the user's own triage
 * decisions, neither of which this should touch. Safe to hard-delete:
 * createInteractionFromEmailThreadIfMissing only ever runs for "auto"
 * matches, so an "unmatched" row never has an Interaction pointing at it.
 *
 * Also clears lastSyncAt: once a sync has succeeded once, every later
 * sync only asks Gmail for threads changed since lastSyncAt (see
 * syncGmailForUser) — without resetting it here, a resync right after
 * clearing would stay scoped to that narrow window and likely never
 * re-fetch the very threads this just deleted, defeating the point of a
 * "clean resync" test.
 */
export async function clearUnmatchedThreadsForUser(userId: string): Promise<{ cleared: number }> {
  const [{ count }] = await prisma.$transaction([
    prisma.emailThread.deleteMany({ where: { userId, matchStatus: "unmatched" } }),
    prisma.gmailAccount.updateMany({ where: { userId }, data: { lastSyncAt: null } }),
  ]);
  return { cleared: count };
}

export async function listTriageThreadsForUser(userId: string) {
  return prisma.emailThread.findMany({
    where: needsReviewWhere(userId),
    include: {
      matchedContact: { select: { id: true, name: true } },
      matchedApplication: { select: { id: true, roleTitle: true, company: { select: { name: true } } } },
    },
    orderBy: { lastMessageAt: "desc" },
  });
}

/** Most-recently-active already-matched threads, for the "Recent emails" pane shown in place of an empty triage queue. */
export async function listRecentMatchedThreadsForUser(userId: string, limit = 5) {
  return prisma.emailThread.findMany({
    where: { userId, matchStatus: { in: ["auto", "confirmed"] } },
    include: {
      matchedContact: { select: { id: true, name: true } },
      matchedApplication: { select: { id: true, roleTitle: true, company: { select: { name: true } } } },
    },
    orderBy: { lastMessageAt: "desc" },
    take: limit,
  });
}

export async function listIgnoredThreadsForUser(userId: string) {
  return prisma.emailThread.findMany({
    where: { userId, matchStatus: "ignored" },
    orderBy: { lastMessageAt: "desc" },
  });
}

/** Un-ignores a thread back to "unmatched" so it reappears in triage for a fresh manual match — the undo path for ignoreEmailThreadMatchForUser. */
export async function restoreEmailThreadMatchForUser(userId: string, emailThreadId: string): Promise<{ ok: boolean }> {
  const { count } = await prisma.emailThread.updateMany({
    where: { id: emailThreadId, userId },
    data: { matchStatus: "unmatched", matchedContactId: null, matchedApplicationId: null },
  });
  return { ok: count > 0 };
}

/**
 * Severs an email thread's link to a contact/application — used both by the
 * triage queue's own "Ignore" and by deleteInteraction below, when the
 * interaction being deleted came from a Gmail sync. Clears the match fields
 * (not just the status) so the thread doesn't sit "ignored" while still
 * displaying a stale matchedContact/matchedApplication, and so a future
 * sync's rematch pass (which only touches "unmatched" threads) leaves it
 * alone rather than silently relinking it.
 */
export async function ignoreEmailThreadMatchForUser(userId: string, emailThreadId: string): Promise<{ ok: boolean }> {
  const { count } = await prisma.emailThread.updateMany({
    where: { id: emailThreadId, userId },
    data: { matchStatus: "ignored", matchedContactId: null, matchedApplicationId: null },
  });
  return { ok: count > 0 };
}

export async function confirmEmailThreadMatchForUser(
  userId: string,
  emailThreadId: string,
  contactId: string | null,
  applicationId: string | null
): Promise<{ ok: boolean }> {
  // Ownership-check the caller-supplied ids before writing them in — this is
  // the one place in the triage flow that takes a contact/application id
  // straight from client input (the picker), unlike linkContactToApplicationForUser
  // or createInteractionForUser, which already verify this. Found by the
  // Phase 4 independent audit.
  if (contactId) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, userId } });
    if (!contact) return { ok: false };
  }
  if (applicationId) {
    const application = await prisma.application.findFirst({ where: { id: applicationId, userId } });
    if (!application) return { ok: false };
  }

  const { count } = await prisma.emailThread.updateMany({
    where: { id: emailThreadId, userId },
    data: { matchedContactId: contactId, matchedApplicationId: applicationId, matchStatus: "confirmed" },
  });
  if (count === 0) return { ok: false };

  const thread = await prisma.emailThread.findFirst({ where: { id: emailThreadId, userId } });
  if (thread) {
    await createInteractionFromEmailThreadIfMissing(userId, thread, contactId, applicationId);
  }
  return { ok: true };
}

export type SuggestedMatch =
  | { ok: true; contactId: string | null; contactConfidence: number | null; applicationId: string | null; applicationConfidence: number | null }
  | { ok: false; error: string };

// On-demand only (never run at sync time) — one Jev call per user click, bounded
// cost. Only ever prefills the triage row's local pick state; Confirm/Ignore are
// unaffected and still required, same as a manual <select> choice.
const MAX_SUGGESTION_CANDIDATES = 40;

export async function suggestMatchForThreadForUser(userId: string, emailThreadId: string): Promise<SuggestedMatch> {
  const thread = await prisma.emailThread.findFirst({ where: { id: emailThreadId, userId } });
  if (!thread) return { ok: false, error: "Thread not found." };

  const [contacts, applications] = await Promise.all([
    listContactsForUser(userId),
    listApplicationPickerOptionsForUser(userId),
  ]);
  // Both already ordered most-recently-updated first — cap as a request-size
  // safety valve, same philosophy as compileResumeSchema's length caps.
  const contactCandidates = contacts.slice(0, MAX_SUGGESTION_CANDIDATES);
  const applicationCandidates = applications.slice(0, MAX_SUGGESTION_CANDIDATES);

  if (contactCandidates.length === 0 && applicationCandidates.length === 0) {
    return { ok: true, contactId: null, contactConfidence: null, applicationId: null, applicationConfidence: null };
  }

  const state = [
    thread.subject ? `Subject: ${thread.subject}` : null,
    thread.snippet ? `Snippet: ${thread.snippet}` : null,
    thread.participants.length ? `Participants: ${thread.participants.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const questions: Record<string, JevQuestion> = {};
  if (contactCandidates.length > 0) {
    questions.contact = {
      type: "choice",
      instructions: "Which contact is this email thread most likely associated with?",
      criteria: {
        none: "None of these contacts",
        ...Object.fromEntries(
          contactCandidates.map((c) => [c.id, [c.name, c.title, c.company?.name].filter(Boolean).join(" — ")])
        ),
      },
    };
  }
  if (applicationCandidates.length > 0) {
    questions.application = {
      type: "choice",
      instructions: "Which job application is this email thread most likely associated with?",
      criteria: {
        none: "None of these applications",
        ...Object.fromEntries(
          applicationCandidates.map((a) => [a.id, `${a.companyName} — ${a.roleTitle} (${a.status})`])
        ),
      },
    };
  }

  const result = await askJev(state, questions);
  if (!result.ok) return { ok: false, error: result.error };

  const contactAnswer = result.answers.contact;
  const applicationAnswer = result.answers.application;
  const contactChoice = contactAnswer && contactAnswer.type === "choice" ? contactAnswer : null;
  const applicationChoice = applicationAnswer && applicationAnswer.type === "choice" ? applicationAnswer : null;

  return {
    ok: true,
    contactId: contactChoice && contactChoice.choice !== "none" ? contactChoice.choice : null,
    contactConfidence: contactChoice ? contactChoice.confidence : null,
    applicationId: applicationChoice && applicationChoice.choice !== "none" ? applicationChoice.choice : null,
    applicationConfidence: applicationChoice ? applicationChoice.confidence : null,
  };
}
