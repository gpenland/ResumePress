import { prisma } from "@/lib/prisma";
import { findOrCreateCompanyForUser } from "@/lib/companies";
import type { Application, ApplicationStatusHistory } from "@prisma/client";
import {
  APPLICATION_STATUSES,
  STATUS_DESCRIPTIONS,
  normalizeStatus,
  type ApplicationStatus,
  type ApplicationWithCompany,
} from "@/lib/applicationsShared";
import { parseStatusHistory, type MappedApplicationRow } from "@/lib/notionImportShared";
import { askJev } from "@/lib/jev";
import { cycleForApplication, currentCycle } from "@/lib/recruitingCycleShared";

// Re-exported so server code (actions.ts) can import everything it needs from
// this one module. Client components should import the shared module
// directly instead — see applicationsShared.ts's header comment for why.
export * from "@/lib/applicationsShared";
export * from "@/lib/recruitingCycleShared";

export type ApplicationInput = {
  companyName: string;
  roleTitle: string;
  term?: string | null;
  status?: string;
  // Ordered past→current statuses (oldest first), used by the CSV importer to seed
  // full ApplicationStatusHistory transitions instead of a single null→status jump.
  // Other callers omit this and get the existing single-entry history behavior.
  statusHistory?: string[];
  appliedAt?: string | null;
  postingUrl?: string | null;
  location?: string | null;
  source?: string | null;
  notes?: string | null;
  externalId?: string | null;
};

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createApplicationForUser(
  userId: string,
  data: ApplicationInput
): Promise<Application> {
  const company = await findOrCreateCompanyForUser(userId, data.companyName);
  const statusChain = (data.statusHistory?.length ? data.statusHistory : [data.status || "Applied"]).map(
    normalizeStatus
  );
  const status = statusChain[statusChain.length - 1];

  return prisma.$transaction(async (tx) => {
    const application = await tx.application.create({
      data: {
        companyId: company.id,
        roleTitle: data.roleTitle,
        term: data.term ?? null,
        status,
        appliedAt: toDate(data.appliedAt),
        postingUrl: data.postingUrl ?? null,
        location: data.location ?? null,
        source: data.source ?? null,
        notes: data.notes ?? null,
        externalId: data.externalId ?? null,
        userId,
      },
    });
    let fromStatus: string | null = null;
    for (const toStatus of statusChain) {
      await tx.applicationStatusHistory.create({
        data: { applicationId: application.id, fromStatus, toStatus, userId },
      });
      fromStatus = toStatus;
    }
    return application;
  });
}

export async function updateApplicationForUser(
  userId: string,
  applicationId: string,
  data: ApplicationInput
): Promise<{ ok: boolean }> {
  const existing = await prisma.application.findFirst({
    where: { id: applicationId, userId },
  });
  if (!existing) return { ok: false };

  const company = await findOrCreateCompanyForUser(userId, data.companyName);
  const status = normalizeStatus(data.status || existing.status);

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.application.updateMany({
      where: { id: applicationId, userId },
      data: {
        companyId: company.id,
        roleTitle: data.roleTitle,
        term: data.term ?? null,
        status,
        appliedAt: toDate(data.appliedAt),
        postingUrl: data.postingUrl ?? null,
        location: data.location ?? null,
        source: data.source ?? null,
        notes: data.notes ?? null,
      },
    });
    if (count === 0) return;

    if (status !== existing.status) {
      await tx.applicationStatusHistory.create({
        data: {
          applicationId,
          fromStatus: existing.status,
          toStatus: status,
          userId,
        },
      });
    }
  });

  return { ok: true };
}

/** Used by the kanban board's drag-to-change-status interaction. */
export async function updateApplicationStatusForUser(
  userId: string,
  applicationId: string,
  newStatus: string
): Promise<{ ok: boolean }> {
  const existing = await prisma.application.findFirst({
    where: { id: applicationId, userId },
  });
  if (!existing) return { ok: false };
  newStatus = normalizeStatus(newStatus);
  if (existing.status === newStatus) return { ok: true };

  await prisma.$transaction([
    prisma.application.updateMany({
      where: { id: applicationId, userId },
      data: { status: newStatus },
    }),
    prisma.applicationStatusHistory.create({
      data: {
        applicationId,
        fromStatus: existing.status,
        toStatus: newStatus,
        userId,
      },
    }),
  ]);

  return { ok: true };
}

export type SuggestedStatus =
  | { ok: true; status: ApplicationStatus | null; confidence: number | null }
  | { ok: false; error: string };

// On-demand only (user-clicked) — never run automatically. The suggestion
// only ever feeds the existing status-change action when the user explicitly
// clicks Apply; nothing here writes anything.
export async function suggestApplicationStatusForUser(userId: string, applicationId: string): Promise<SuggestedStatus> {
  const application = await getApplicationForUser(userId, applicationId);
  if (!application) return { ok: false, error: "Application not found." };

  const emailInteractions = application.interactions
    .filter((i) => i.emailThread)
    .slice(0, 3);
  if (emailInteractions.length === 0) {
    return { ok: true, status: null, confidence: null };
  }

  const state = emailInteractions
    .map((i) => {
      const thread = i.emailThread!;
      return [thread.subject ? `Subject: ${thread.subject}` : null, thread.snippet ? `Snippet: ${thread.snippet}` : null]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const result = await askJev(state, {
    status: {
      type: "choice",
      instructions: "Based on these recent emails, what is the most likely current status of this job application?",
      criteria: Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, STATUS_DESCRIPTIONS[s]])),
    },
  });
  if (!result.ok) return { ok: false, error: result.error };

  const answer = result.answers.status;
  if (answer.type !== "choice") return { ok: false, error: "Unexpected response from Jev." };

  const suggested = APPLICATION_STATUSES.includes(answer.choice as ApplicationStatus) ? (answer.choice as ApplicationStatus) : null;
  if (!suggested || suggested === application.status) {
    return { ok: true, status: null, confidence: null };
  }

  return { ok: true, status: suggested, confidence: answer.confidence };
}

/**
 * Adds a note-only history entry (fromStatus === toStatus === current status)
 * without changing the application's status. GitHub issue #17: lets a user
 * log an event ("2nd interview scheduled") without inventing a custom status.
 */
export async function logApplicationUpdateForUser(
  userId: string,
  applicationId: string,
  note: string
): Promise<{ ok: boolean }> {
  const existing = await prisma.application.findFirst({
    where: { id: applicationId, userId },
  });
  if (!existing) return { ok: false };

  await prisma.applicationStatusHistory.create({
    data: {
      applicationId,
      fromStatus: existing.status,
      toStatus: existing.status,
      note,
      userId,
    },
  });

  return { ok: true };
}

/** Adds or edits the note on an existing history entry after the fact. */
export async function setApplicationHistoryNoteForUser(
  userId: string,
  historyId: string,
  note: string
): Promise<{ ok: boolean }> {
  const { count } = await prisma.applicationStatusHistory.updateMany({
    where: { id: historyId, userId },
    data: { note: note || null },
  });
  return { ok: count > 0 };
}

/**
 * Deletes a status-history entry — but only the single most recent entry for
 * its application, and never the creation entry (fromStatus === null).
 * Deleting from the middle of the chain would leave the Application's live
 * `status` out of sync with its own history tail, with no well-defined value
 * to recompute it to, so this only ever "pops" the latest entry off the
 * stack, reverting `status` back to that entry's fromStatus when it was a
 * real status change (not a note-only log update).
 *
 * This is the intended fix for a misclicked status change: deleting the bad
 * entry undoes it in place, instead of setting the status back by hand —
 * which would log a *second*, reverse transition and show up as a
 * backward-curving link in the Sankey flow view (see
 * ApplicationStatusSankey.tsx / getApplicationStatusFlowForUser). Deleting
 * repeatedly, most-recent-first, also cleans up a chain that already has
 * this kind of flip-flop in it.
 */
export async function deleteApplicationStatusHistoryEntryForUser(
  userId: string,
  applicationId: string,
  historyId: string
): Promise<{ ok: boolean }> {
  const entry = await prisma.applicationStatusHistory.findFirst({
    where: { id: historyId, userId, applicationId },
  });
  if (!entry || entry.fromStatus === null) return { ok: false };
  const fromStatus = entry.fromStatus;

  const latest = await prisma.applicationStatusHistory.findFirst({
    where: { applicationId, userId },
    orderBy: { changedAt: "desc" },
  });
  if (!latest || latest.id !== entry.id) return { ok: false };

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.applicationStatusHistory.deleteMany({
      where: { id: historyId, userId },
    });
    if (count === 0) return;
    if (entry.toStatus !== fromStatus) {
      await tx.application.updateMany({
        where: { id: applicationId, userId },
        data: { status: fromStatus },
      });
    }
  });

  return { ok: true };
}

// Shared by every cycle-filtered query below (cycle isn't a stored column —
// see recruitingCycleShared.ts), so the "compute each row's cycle, keep the
// ones in the wanted set" loop isn't repeated at each call site. cycles is
// undefined for "all cycles" (no filtering, see parseCycleSearchParam).
function filterByCycle<T extends { term: string | null; appliedAt: Date | null }>(
  rows: T[],
  cycles: number[] | undefined
): T[] {
  if (!cycles) return rows;
  const wanted = new Set(cycles);
  return rows.filter((r) => {
    const cycle = cycleForApplication(r.term, r.appliedAt);
    return cycle !== null && wanted.has(cycle);
  });
}

// Minimal projection needed to compute each application's cycle — shared by
// listApplicationCycleOptionsForUser and getApplicationStatusFlowForUser,
// neither of which needs any other application field.
function fetchApplicationCycleRows(userId: string) {
  return prisma.application.findMany({
    where: { userId },
    select: { id: true, term: true, appliedAt: true },
  });
}

export async function listApplicationsForUser(
  userId: string,
  opts?: { status?: string; companyId?: string; cycles?: number[] }
): Promise<ApplicationWithCompany[]> {
  const applications = await prisma.application.findMany({
    where: {
      userId,
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.companyId ? { companyId: opts.companyId } : {}),
    },
    include: { company: true },
    orderBy: { updatedAt: "desc" },
  });
  return filterByCycle(applications, opts?.cycles);
}

// Cycle options for the filter dropdown: every cycle actually present in the
// user's applications, plus the current cycle even if it's still empty (so
// a user starting a fresh cycle isn't offered an empty list), newest first.
export async function listApplicationCycleOptionsForUser(userId: string): Promise<number[]> {
  const rows = await fetchApplicationCycleRows(userId);
  const cycles = new Set<number>([currentCycle()]);
  for (const { term, appliedAt } of rows) {
    const cycle = cycleForApplication(term, appliedAt);
    if (cycle !== null) cycles.add(cycle);
  }
  return Array.from(cycles).sort((a, b) => b - a);
}

export type StatusFlowLink = { source: string; target: string; value: number };

/**
 * Aggregates every status transition across all of a user's applications into
 * (source, target, count) edges for the Sankey flow view. Each
 * ApplicationStatusHistory row already records one discrete transition, so no
 * per-application chain-walking is needed — just drop note-only rows
 * (fromStatus === toStatus, logged via logApplicationUpdateForUser) and
 * aggregate the rest. A null fromStatus (the application's creation) becomes
 * the synthetic "Start" source.
 */
export async function getApplicationStatusFlowForUser(
  userId: string,
  opts?: { cycles?: number[] }
): Promise<StatusFlowLink[]> {
  let applicationIds: string[] | undefined;
  if (opts?.cycles) {
    const rows = await fetchApplicationCycleRows(userId);
    applicationIds = filterByCycle(rows, opts.cycles).map((a) => a.id);
  }

  const history = await prisma.applicationStatusHistory.findMany({
    where: { userId, ...(applicationIds ? { applicationId: { in: applicationIds } } : {}) },
    select: { fromStatus: true, toStatus: true },
  });

  const counts = new Map<string, number>();
  for (const { fromStatus, toStatus } of history) {
    if (fromStatus === toStatus) continue;
    const key = `${fromStatus ?? "Start"}\u0000${toStatus}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([key, value]) => {
    const [source, target] = key.split("\u0000");
    return { source, target, value };
  });
}

export type ApplicationPipelineStats = {
  total: number;
  active: number;
  offers: number;
  offerRate: number | null;
  rejections: number;
  rejectionRate: number | null;
  newThisWeek: number;
  newLastWeek: number;
  byStatus: { status: string; count: number }[];
};

function statusRank(status: string): number {
  const i = APPLICATION_STATUSES.indexOf(status as ApplicationStatus);
  return i === -1 ? APPLICATION_STATUSES.length : i;
}

/**
 * Powers the dashboard Statistics panel. "Active" means not
 * Rejected/Ghosted/Withdrawn — an Offer still counts as active (there's no
 * separate "accepted" status, and the search isn't over until the user acts
 * on the offer).
 * newThisWeek/newLastWeek are rolling 7-day windows off appliedAt (not
 * createdAt — when it was actually applied to, not when the row was logged
 * into the tracker, and not calendar weeks), so the "vs last week" delta is
 * always comparing two full 7-day periods regardless of what day it is.
 * Applications with no appliedAt yet (tracked before applying) don't count
 * toward either bucket.
 */
export async function getApplicationPipelineStatsForUser(
  userId: string,
  opts?: { cycles?: number[] }
): Promise<ApplicationPipelineStats> {
  const rows = await prisma.application.findMany({
    where: { userId },
    select: { status: true, appliedAt: true, term: true },
  });
  const applications = filterByCycle(rows, opts?.cycles);

  const now = Date.now();
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  const counts = new Map<string, number>();
  let active = 0;
  let offers = 0;
  let rejections = 0;
  let newThisWeek = 0;
  let newLastWeek = 0;

  for (const { status, appliedAt } of applications) {
    counts.set(status, (counts.get(status) ?? 0) + 1);
    if (status !== "Rejected" && status !== "Ghosted" && status !== "Withdrawn") active++;
    if (status === "Offer") offers++;
    if (status === "Rejected") rejections++;

    if (!appliedAt) continue;
    const age = now - appliedAt.getTime();
    if (age < WEEK_MS) newThisWeek++;
    else if (age < 2 * WEEK_MS) newLastWeek++;
  }

  const byStatus = Array.from(counts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.status.localeCompare(b.status));

  return {
    total: applications.length,
    active,
    offers,
    offerRate: applications.length === 0 ? null : offers / applications.length,
    rejections,
    rejectionRate: applications.length === 0 ? null : rejections / applications.length,
    newThisWeek,
    newLastWeek,
    byStatus,
  };
}

/**
 * Bulk status change for the applications list's multi-select action bar
 * (and the MCP bulk_update_application_status tool). Mirrors
 * updateApplicationStatusForUser per id: ownership-checked read, skip
 * no-ops, update + history write in one transaction. Ids not owned by the
 * caller (or already missing) are silently skipped rather than failing the
 * whole batch.
 */
export async function bulkUpdateApplicationStatusForUser(
  userId: string,
  ids: string[],
  status: string
): Promise<void> {
  status = normalizeStatus(status);
  for (const id of ids) {
    const existing = await prisma.application.findFirst({ where: { id, userId } });
    if (!existing || existing.status === status) continue;

    await prisma.$transaction([
      prisma.application.updateMany({
        where: { id, userId },
        data: { status },
      }),
      prisma.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStatus: existing.status,
          toStatus: status,
          userId,
        },
      }),
    ]);
  }
}

/** Bulk delete for the applications list's multi-select action bar (and the MCP bulk_delete_applications tool). */
export async function bulkDeleteApplicationsForUser(userId: string, ids: string[]): Promise<void> {
  await prisma.application.deleteMany({ where: { id: { in: ids }, userId } });
}

export async function getApplicationForUser(userId: string, applicationId: string) {
  return prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: {
      company: true,
      resume: true,
      resumeSnapshot: true,
      statusHistory: { orderBy: { changedAt: "desc" } },
      contacts: { include: { contact: true } },
      interactions: { orderBy: { occurredAt: "desc" }, include: { emailThread: true } },
    },
  });
}

export type ApplicationHistoryEntry = ApplicationStatusHistory;

/**
 * Commits a Notion-importer dry-run (PLAN.md §6 Phase 3). Idempotent on
 * re-run: a row whose mapped `externalId` matches an existing Application's
 * updates that row instead of creating a duplicate. Rows with no mapped
 * `externalId` always create a new Application — there's no stable key to
 * match on, so re-running an import with no ID column produces duplicates,
 * same as any other id-less CSV import.
 */
export async function importMappedApplicationsForUser(
  userId: string,
  rows: MappedApplicationRow[]
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    // Notion exports a status property's full option history as a comma-separated
    // list (e.g. "Applied, Rejected"), not just the current value — see
    // parseStatusHistory's comment. Resolve to the last recognized entry rather
    // than matching the raw string against APPLICATION_STATUSES, which would
    // always miss and silently fall back to the "Applied" default.
    const statusChain = parseStatusHistory(row.status);
    const status = statusChain[statusChain.length - 1];

    const input: ApplicationInput = {
      companyName: row.companyName,
      roleTitle: row.roleTitle,
      term: row.term,
      status,
      statusHistory: statusChain.length ? statusChain : undefined,
      appliedAt: row.appliedAt,
      postingUrl: row.postingUrl,
      location: row.location,
      source: row.source,
      notes: row.notes,
      externalId: row.externalId,
    };

    const existing = row.externalId
      ? await prisma.application.findFirst({ where: { userId, externalId: row.externalId } })
      : null;

    if (existing) {
      await updateApplicationForUser(userId, existing.id, input);
      updated++;
    } else {
      await createApplicationForUser(userId, input);
      created++;
    }
  }

  return { created, updated };
}
