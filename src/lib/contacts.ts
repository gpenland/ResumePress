import { prisma } from "@/lib/prisma";
import { findOrCreateCompanyForUser } from "@/lib/companies";
import type { Contact, Company } from "@prisma/client";

export type ContactWithCompany = Contact & { company: Company | null };

export type ContactInput = {
  name: string;
  companyName?: string | null;
  title?: string | null;
  emails?: string[];
  linkedinUrl?: string | null;
  phone?: string | null;
  howMet?: string | null;
  metAt?: string | null;
  tags?: string[];
  nextFollowUpAt?: string | null;
  notes?: string | null;
};

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function resolveCompanyId(userId: string, companyName?: string | null): Promise<string | null> {
  if (!companyName || !companyName.trim()) return null;
  const company = await findOrCreateCompanyForUser(userId, companyName);
  return company.id;
}

export async function createContactForUser(userId: string, data: ContactInput): Promise<Contact> {
  const companyId = await resolveCompanyId(userId, data.companyName);

  return prisma.contact.create({
    data: {
      name: data.name,
      companyId,
      title: data.title ?? null,
      emails: data.emails ?? [],
      linkedinUrl: data.linkedinUrl ?? null,
      phone: data.phone ?? null,
      howMet: data.howMet ?? null,
      metAt: toDate(data.metAt),
      tags: data.tags ?? [],
      nextFollowUpAt: toDate(data.nextFollowUpAt),
      notes: data.notes ?? null,
      userId,
    },
  });
}

export async function updateContactForUser(
  userId: string,
  contactId: string,
  data: ContactInput
): Promise<{ ok: boolean }> {
  const companyId = await resolveCompanyId(userId, data.companyName);

  const { count } = await prisma.contact.updateMany({
    where: { id: contactId, userId },
    data: {
      name: data.name,
      companyId,
      title: data.title ?? null,
      emails: data.emails ?? [],
      linkedinUrl: data.linkedinUrl ?? null,
      phone: data.phone ?? null,
      howMet: data.howMet ?? null,
      metAt: toDate(data.metAt),
      tags: data.tags ?? [],
      nextFollowUpAt: toDate(data.nextFollowUpAt),
      notes: data.notes ?? null,
    },
  });
  return { ok: count > 0 };
}

export async function listContactsForUser(
  userId: string,
  opts?: { followUpDue?: boolean }
): Promise<ContactWithCompany[]> {
  return prisma.contact.findMany({
    where: {
      userId,
      ...(opts?.followUpDue ? { nextFollowUpAt: { lte: new Date() } } : {}),
    },
    include: { company: true },
    orderBy: { updatedAt: "desc" },
  });
}

/** Minimal id+name list for pickers (e.g. the global "Log interaction" quick-add). */
export async function listContactOptionsForUser(userId: string) {
  return prisma.contact.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** contactId -> ids of applications explicitly linked to them (ApplicationContact), for narrowing an application picker once a contact is chosen. */
export async function listApplicationIdsByContactForUser(userId: string): Promise<Record<string, string[]>> {
  const links = await prisma.applicationContact.findMany({
    where: { userId },
    select: { contactId: true, applicationId: true },
  });
  const byContact: Record<string, string[]> = {};
  for (const link of links) {
    (byContact[link.contactId] ??= []).push(link.applicationId);
  }
  return byContact;
}

export async function getContactForUser(userId: string, contactId: string) {
  return prisma.contact.findFirst({
    where: { id: contactId, userId },
    include: {
      company: true,
      interactions: { orderBy: { occurredAt: "desc" }, include: { emailThread: true } },
      applications: {
        include: { application: { include: { company: true } } },
      },
    },
  });
}

/** Links a contact to an application with a role, or updates the role if already linked. */
export async function linkContactToApplicationForUser(
  userId: string,
  contactId: string,
  applicationId: string,
  role: string
): Promise<{ ok: boolean }> {
  const [contact, application] = await Promise.all([
    prisma.contact.findFirst({ where: { id: contactId, userId } }),
    prisma.application.findFirst({ where: { id: applicationId, userId } }),
  ]);
  if (!contact || !application) return { ok: false };

  await prisma.applicationContact.upsert({
    where: { applicationId_contactId: { applicationId, contactId } },
    create: { applicationId, contactId, role, userId },
    update: { role },
  });
  return { ok: true };
}

export async function unlinkContactFromApplicationForUser(
  userId: string,
  contactId: string,
  applicationId: string
): Promise<{ ok: boolean }> {
  const { count } = await prisma.applicationContact.deleteMany({
    where: { applicationId, contactId, userId },
  });
  return { ok: count > 0 };
}
