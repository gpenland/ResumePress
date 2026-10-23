import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import {
  refreshAccessToken,
  listLabels,
  getProfile,
  listMessageIdsForLabel,
  listNewThreadIdsSinceHistory,
  getThread,
  gmailThreadUrl,
  GmailApiError,
  type GmailLabel,
  type GmailThread,
} from "@/lib/gmail";
import type { EmailThread } from "@prisma/client";

const SYSTEM_LABEL_ALLOWLIST = new Set(["INBOX", "SENT", "STARRED", "IMPORTANT"]);

export async function getValidAccessTokenForUser(userId: string): Promise<string> {
  const account = await prisma.gmailAccount.findUnique({ where: { userId } });
  if (!account) throw new GmailApiError("Gmail is not connected.");
  return refreshAccessToken(decrypt(account.encryptedRefreshToken));
}

/** Filters out Gmail's noisy CATEGORY_ and CHAT system labels — keeps user-created labels plus the handful of system labels someone would plausibly want to sync. */
export async function listAvailableLabelsForUser(userId: string): Promise<GmailLabel[]> {
  const accessToken = await getValidAccessTokenForUser(userId);
  const labels = await listLabels(accessToken);
  return labels.filter((l) => l.type === "user" || SYSTEM_LABEL_ALLOWLIST.has(l.id));
}

export async function updateSyncLabelsForUser(userId: string, labelIds: string[]): Promise<void> {
  await prisma.gmailAccount.update({ where: { userId }, data: { syncLabelIds: labelIds } });
}

type MatchCandidates = {
  contactsByEmail: Map<string, string>;
  applicationByDomain: Map<string, string>;
};

function extractDomain(url: string): string | null {
  try {
    const withProtocol = url.startsWith("http") ? url : `https://${url}`;
    return new URL(withProtocol).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

async function loadMatchCandidates(userId: string): Promise<MatchCandidates> {
  const [contacts, companies] = await Promise.all([
    prisma.contact.findMany({ where: { userId }, select: { id: true, emails: true } }),
    prisma.company.findMany({
      where: { userId },
      select: {
        id: true,
        website: true,
        applications: { select: { id: true }, orderBy: { updatedAt: "desc" }, take: 1 },
      },
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

  return { contactsByEmail, applicationByDomain };
}

/**
 * Exact participant-email-to-contact match only; anything else is a
 * suggestion, never auto-linked (PLAN.md §4: "Auto-link only on exact
 * contact-email matches. Everything else goes to a triage queue").
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

/** Mirrors a confirmed/auto match onto the contact's or application's interaction timeline. No-ops if already created (idempotent across resyncs). */
async function createInteractionFromEmailThreadIfMissing(
  userId: string,
  emailThread: Pick<EmailThread, "id" | "subject" | "snippet" | "lastMessageAt">,
  contactId: string | null,
  applicationId: string | null
): Promise<void> {
  if (!contactId && !applicationId) return;
  const existing = await prisma.interaction.findFirst({ where: { emailThreadId: emailThread.id, userId } });
  if (existing) return;

  await prisma.interaction.create({
    data: {
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

export type SyncResult = { ok: true; threadsUpserted: number } | { ok: false; error: string };

/**
 * Manual "Sync now" (PLAN.md §4). Uses the History API when a baseline
 * historyId exists, falling back to a plain per-label message list (capped,
 * no pagination — fine at personal scale) on the first sync or whenever the
 * history window has expired. This is the least-proven part of the whole
 * tracker (see docs/MIGRATION_PLAN.md §6 risk 3) and has not been exercised
 * against a live Gmail account — verify manually before relying on it, and
 * before wiring a scheduled/cron sync on top of it.
 */
export async function syncGmailForUser(userId: string): Promise<SyncResult> {
  const account = await prisma.gmailAccount.findUnique({ where: { userId } });
  if (!account) return { ok: false, error: "Gmail is not connected." };
  if (account.syncLabelIds.length === 0) {
    return { ok: false, error: "Select at least one label to sync first." };
  }

  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(decrypt(account.encryptedRefreshToken));
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to refresh Gmail access." };
  }

  const candidates = await loadMatchCandidates(userId);
  const threadIds = new Set<string>();

  for (const labelId of account.syncLabelIds) {
    let ids: string[] = [];
    try {
      if (!account.historyId) throw new GmailApiError("no baseline historyId yet");
      ids = await listNewThreadIdsSinceHistory(accessToken, account.historyId, labelId);
    } catch {
      try {
        ids = await listMessageIdsForLabel(accessToken, labelId);
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Failed to list Gmail messages." };
      }
    }
    ids.forEach((id) => threadIds.add(id));
  }

  let upserted = 0;
  for (const gmailThreadId of threadIds) {
    let gmailThread: GmailThread;
    try {
      gmailThread = await getThread(accessToken, gmailThreadId);
    } catch {
      continue; // skip threads that fail to fetch rather than aborting the whole sync
    }

    const existing = await prisma.emailThread.findUnique({
      where: { userId_gmailThreadId: { userId, gmailThreadId: gmailThread.id } },
    });

    // Preserve a user's own triage decision (confirmed/ignored) across resyncs.
    const match =
      existing && existing.matchStatus !== "unmatched"
        ? { contactId: existing.matchedContactId, applicationId: existing.matchedApplicationId, matchStatus: existing.matchStatus }
        : matchThread(gmailThread, candidates);

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
        userId,
      },
      update: {
        subject: gmailThread.subject,
        snippet: gmailThread.snippet,
        participants: gmailThread.participants,
        lastMessageAt: gmailThread.lastMessageAt,
        matchedContactId: match.contactId,
        matchedApplicationId: match.applicationId,
        matchStatus: match.matchStatus,
      },
    });
    upserted++;

    if (match.matchStatus === "auto") {
      await createInteractionFromEmailThreadIfMissing(userId, emailThreadRow, match.contactId, match.applicationId);
    }
  }

  let newHistoryId = account.historyId;
  try {
    newHistoryId = (await getProfile(accessToken)).historyId;
  } catch {
    // Keep the old historyId — the next sync just falls back to a full list again.
  }

  await prisma.gmailAccount.update({
    where: { userId },
    data: { historyId: newHistoryId, lastSyncAt: new Date() },
  });

  return { ok: true, threadsUpserted: upserted };
}

export async function listTriageThreadsForUser(userId: string) {
  return prisma.emailThread.findMany({
    where: { userId, matchStatus: "unmatched" },
    include: {
      matchedContact: { select: { id: true, name: true } },
      matchedApplication: { select: { id: true, roleTitle: true, company: { select: { name: true } } } },
    },
    orderBy: { lastMessageAt: "desc" },
  });
}

export async function confirmEmailThreadMatchForUser(
  userId: string,
  emailThreadId: string,
  contactId: string | null,
  applicationId: string | null
): Promise<{ ok: boolean }> {
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

export async function ignoreEmailThreadMatchForUser(userId: string, emailThreadId: string): Promise<{ ok: boolean }> {
  const { count } = await prisma.emailThread.updateMany({
    where: { id: emailThreadId, userId },
    data: { matchStatus: "ignored" },
  });
  return { ok: count > 0 };
}
