import { prisma } from "@/lib/prisma";
import type { Resume, ResumeSnapshot } from "@prisma/client";
import type { EntriesByCategory, EntryLike } from "@/templates/jake";

export type ResumeIdentity = {
  name: string;
  email: string;
  phone?: string;
  website?: string;
  linkedin?: string;
  github?: string;
};

export type ResumeInput = {
  name: string;
  templateId?: string;
  identity: ResumeIdentity;
};

export async function createResumeForUser(
  userId: string,
  data: ResumeInput
): Promise<Resume> {
  return prisma.resume.create({
    data: {
      name: data.name,
      templateId: data.templateId ?? "jake",
      identity: {
        name: data.identity.name,
        email: data.identity.email,
        phone: data.identity.phone ?? "",
        website: data.identity.website ?? "",
        linkedin: data.identity.linkedin ?? "",
        github: data.identity.github ?? "",
      },
      userId,
    },
  });
}

export async function listResumesForUser(userId: string): Promise<Resume[]> {
  return prisma.resume.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getResumeForUser(userId: string, resumeId: string) {
  return prisma.resume.findFirst({
    where: { id: resumeId, userId },
    include: {
      entries: {
        orderBy: { order: "asc" },
        include: { entry: { include: { category: true } } },
      },
    },
  });
}

type ResumeWithEntries = NonNullable<Awaited<ReturnType<typeof getResumeForUser>>>;

// The frozen shape stored in ResumeSnapshot.entries — same grouping the PDF
// route itself does (one section per category, in first-seen order), but
// with each Entry's content inlined instead of a live FK, plus the
// category's slug/name alongside it so a snapshot never needs to re-look up
// a Category row to compile to PDF later.
export type ResumeSnapshotSection = {
  categorySlug: string;
  categoryName: string;
  entries: EntryLike[];
};

function buildSnapshotSections(resume: ResumeWithEntries): ResumeSnapshotSection[] {
  const byCategory = new Map<string, ResumeSnapshotSection>();
  for (const re of resume.entries) {
    const cat = re.entry.category;
    if (!byCategory.has(cat.id)) {
      byCategory.set(cat.id, { categorySlug: cat.slug, categoryName: cat.name, entries: [] });
    }
    byCategory.get(cat.id)!.entries.push({
      title: re.entry.title,
      organization: re.entry.organization,
      location: re.entry.location,
      startDate: re.entry.startDate,
      endDate: re.entry.endDate,
      description: re.entry.description,
      bullets: re.entry.bullets,
      tags: re.entry.tags,
    });
  }
  return Array.from(byCategory.values());
}

export function snapshotSectionsToEntriesByCategory(sections: ResumeSnapshotSection[]): EntriesByCategory {
  return sections.map((s) => ({
    category: { slug: s.categorySlug, name: s.categoryName },
    entries: s.entries,
  }));
}

/**
 * Freezes a full copy of a Resume's current content (identity + inlined
 * entry content, not live Entry references) into a new ResumeSnapshot.
 * GitHub issue #26 — called when a resume is attached to an Application so
 * later edits to the Resume's entries don't retroactively change what's
 * recorded as having been sent for that application.
 */
export async function createResumeSnapshotForUser(
  userId: string,
  resumeId: string
): Promise<ResumeSnapshot | null> {
  const resume = await getResumeForUser(userId, resumeId);
  if (!resume) return null;

  return prisma.resumeSnapshot.create({
    data: {
      resumeId: resume.id,
      name: resume.name,
      templateId: resume.templateId,
      identity: resume.identity ?? undefined,
      entries: buildSnapshotSections(resume),
      userId,
    },
  });
}
