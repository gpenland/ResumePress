import { prisma } from "@/lib/prisma";
import { findOrCreateCompanyForUser } from "@/lib/companies";
import type { Application, ApplicationStatusHistory } from "@prisma/client";
import { APPLICATION_STATUSES, type ApplicationStatus, type ApplicationWithCompany } from "@/lib/applicationsShared";
import { parseStatusHistory, type MappedApplicationRow } from "@/lib/notionImportShared";

// Re-exported so server code (actions.ts) can import everything it needs from
// this one module. Client components should import the shared module
// directly instead — see applicationsShared.ts's header comment for why.
export * from "@/lib/applicationsShared";

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
  const statusChain = data.statusHistory?.length ? data.statusHistory : [data.status || "Applied"];
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
  const status = data.status || existing.status;

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

export async function listApplicationsForUser(
  userId: string,
  opts?: { status?: string; companyId?: string }
): Promise<ApplicationWithCompany[]> {
  return prisma.application.findMany({
    where: {
      userId,
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.companyId ? { companyId: opts.companyId } : {}),
    },
    include: { company: true },
    orderBy: { updatedAt: "desc" },
  });
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
export async function getApplicationStatusFlowForUser(userId: string): Promise<StatusFlowLink[]> {
  const history = await prisma.applicationStatusHistory.findMany({
    where: { userId },
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
  newThisWeek: number;
  newLastWeek: number;
  byStatus: { status: string; count: number }[];
};

function statusRank(status: string): number {
  const i = APPLICATION_STATUSES.indexOf(status as ApplicationStatus);
  return i === -1 ? APPLICATION_STATUSES.length : i;
}

/**
 * Powers the dashboard Statistics panel. "Active" means not Rejected/Ghosted
 * — an Offer still counts as active (there's no separate "accepted" status,
 * and the search isn't over until the user acts on the offer).
 * newThisWeek/newLastWeek are rolling 7-day windows off createdAt (not
 * calendar weeks), so the "vs last week" delta is always comparing two full
 * 7-day periods regardless of what day it is.
 */
export async function getApplicationPipelineStatsForUser(userId: string): Promise<ApplicationPipelineStats> {
  const applications = await prisma.application.findMany({
    where: { userId },
    select: { status: true, createdAt: true },
  });

  const now = Date.now();
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  const counts = new Map<string, number>();
  let active = 0;
  let offers = 0;
  let newThisWeek = 0;
  let newLastWeek = 0;

  for (const { status, createdAt } of applications) {
    counts.set(status, (counts.get(status) ?? 0) + 1);
    if (status !== "Rejected" && status !== "Ghosted") active++;
    if (status === "Offer") offers++;

    const age = now - createdAt.getTime();
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
    newThisWeek,
    newLastWeek,
    byStatus,
  };
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
