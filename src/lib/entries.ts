import { prisma } from "@/lib/prisma";
import type { Entry } from "@prisma/client";

export type EntryInput = {
  title: string;
  categoryId: string;
  pdfTitle?: string | null;
  organization?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
  url?: string | null;
  bullets?: string[];
  tags?: string[];
};

export type CreateEntryResult =
  | { ok: true; entry: Entry }
  | { ok: false; error: string };

export async function createEntryForUser(
  userId: string,
  data: EntryInput
): Promise<CreateEntryResult> {
  const category = await prisma.category.findFirst({
    where: { id: data.categoryId, OR: [{ userId: null }, { userId }] },
  });
  if (!category) {
    return { ok: false, error: `Category ${data.categoryId} not found` };
  }

  const entry = await prisma.entry.create({
    data: {
      title: data.title,
      pdfTitle: data.pdfTitle ?? null,
      organization: data.organization ?? null,
      location: data.location ?? null,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      description: data.description ?? null,
      url: data.url ?? null,
      bullets: data.bullets ?? [],
      tags: data.tags ?? [],
      categoryId: data.categoryId,
      userId,
    },
  });

  return { ok: true, entry };
}

export async function listEntriesForUser(
  userId: string,
  opts?: { categoryId?: string }
): Promise<Entry[]> {
  return prisma.entry.findMany({
    where: { userId, ...(opts?.categoryId ? { categoryId: opts.categoryId } : {}) },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getEntryForUser(
  userId: string,
  entryId: string
): Promise<Entry | null> {
  return prisma.entry.findFirst({ where: { id: entryId, userId } });
}
