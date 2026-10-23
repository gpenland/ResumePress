import { prisma } from "@/lib/prisma";
import { findOrCreateCompanyForUser } from "@/lib/companies";
import type { Application, ApplicationStatusHistory } from "@prisma/client";
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
  type ApplicationWithCompany,
} from "@/lib/applicationsShared";
import type { MappedApplicationRow } from "@/lib/notionImportShared";

// Re-exported so server code (actions.ts) can import everything it needs from
// this one module. Client components should import the shared module
// directly instead — see applicationsShared.ts's header comment for why.
export * from "@/lib/applicationsShared";

export type ApplicationInput = {
  companyName: string;
  roleTitle: string;
  term?: string | null;
  status?: string;
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
  const status = data.status || "Applied";

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
    await tx.applicationStatusHistory.create({
      data: {
        applicationId: application.id,
        fromStatus: null,
        toStatus: status,
        userId,
      },
    });
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

export async function getApplicationForUser(userId: string, applicationId: string) {
  return prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: {
      company: true,
      resume: true,
      statusHistory: { orderBy: { changedAt: "desc" } },
      contacts: { include: { contact: true } },
      interactions: { orderBy: { occurredAt: "desc" } },
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
    const input: ApplicationInput = {
      companyName: row.companyName,
      roleTitle: row.roleTitle,
      term: row.term,
      status: APPLICATION_STATUSES.includes(row.status as ApplicationStatus) ? row.status! : undefined,
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
