import { prisma } from "@/lib/prisma";

export type SearchResults = {
  applications: Array<{ id: string; roleTitle: string; companyName: string }>;
  contacts: Array<{ id: string; name: string; companyName: string | null }>;
  interactions: Array<{ id: string; type: string; summary: string; contactId: string | null; applicationId: string | null }>;
};

const EMPTY_RESULTS: SearchResults = { applications: [], contacts: [], interactions: [] };

/** Case-insensitive substring search across applications, contacts, and interaction notes/summaries (PLAN.md §4 "Global search"). */
export async function globalSearch(userId: string, query: string): Promise<SearchResults> {
  const q = query.trim();
  if (!q) return EMPTY_RESULTS;

  const [applications, contacts, interactions] = await Promise.all([
    prisma.application.findMany({
      where: {
        userId,
        OR: [
          { roleTitle: { contains: q, mode: "insensitive" } },
          { notes: { contains: q, mode: "insensitive" } },
          { company: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: { company: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.contact.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { notes: { contains: q, mode: "insensitive" } },
          { company: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: { company: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.interaction.findMany({
      where: { userId, summary: { contains: q, mode: "insensitive" } },
      orderBy: { occurredAt: "desc" },
      take: 20,
    }),
  ]);

  return {
    applications: applications.map((a) => ({ id: a.id, roleTitle: a.roleTitle, companyName: a.company.name })),
    contacts: contacts.map((c) => ({ id: c.id, name: c.name, companyName: c.company?.name ?? null })),
    interactions: interactions.map((i) => ({
      id: i.id,
      type: i.type,
      summary: i.summary,
      contactId: i.contactId,
      applicationId: i.applicationId,
    })),
  };
}
