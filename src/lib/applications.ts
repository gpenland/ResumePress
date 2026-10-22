import { prisma } from "@/lib/prisma";
import { findOrCreateCompanyForUser } from "@/lib/companies";
import type { Application, ApplicationStatusHistory } from "@prisma/client";
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
  type ApplicationWithCompany,
  type ApplicationCsvRow,
} from "@/lib/applicationsShared";

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
  deadline?: string | null;
  postingUrl?: string | null;
  location?: string | null;
  source?: string | null;
  priority?: string | null;
  nextFollowUpAt?: string | null;
  notes?: string | null;
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
  const status = data.status || "Wishlist";

  return prisma.$transaction(async (tx) => {
    const application = await tx.application.create({
      data: {
        companyId: company.id,
        roleTitle: data.roleTitle,
        term: data.term ?? null,
        status,
        appliedAt: toDate(data.appliedAt),
        deadline: toDate(data.deadline),
        postingUrl: data.postingUrl ?? null,
        location: data.location ?? null,
        source: data.source ?? null,
        priority: data.priority ?? null,
        nextFollowUpAt: toDate(data.nextFollowUpAt),
        notes: data.notes ?? null,
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
        deadline: toDate(data.deadline),
        postingUrl: data.postingUrl ?? null,
        location: data.location ?? null,
        source: data.source ?? null,
        priority: data.priority ?? null,
        nextFollowUpAt: toDate(data.nextFollowUpAt),
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
    },
  });
}

export type ApplicationHistoryEntry = ApplicationStatusHistory;

export async function importApplicationCsvRowsForUser(
  userId: string,
  rows: ApplicationCsvRow[]
): Promise<{ imported: number }> {
  let imported = 0;
  for (const row of rows) {
    await createApplicationForUser(userId, {
      companyName: row.company,
      roleTitle: row.roleTitle,
      term: row.term || null,
      status: APPLICATION_STATUSES.includes(row.status as ApplicationStatus)
        ? row.status
        : "Wishlist",
      appliedAt: row.appliedAt || null,
      deadline: row.deadline || null,
      postingUrl: row.postingUrl || null,
      location: row.location || null,
      source: row.source || null,
      priority: row.priority || null,
      nextFollowUpAt: row.nextFollowUpAt || null,
      notes: row.notes || null,
    });
    imported++;
  }
  return { imported };
}
