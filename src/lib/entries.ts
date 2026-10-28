import { prisma } from "@/lib/prisma";
import type { Entry, EntryVersion } from "@prisma/client";

export type EntryInput = {
  title: string;
  categoryId: string;
  displayTitle?: string | null;
  organization?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
  url?: string | null;
  bullets?: string[];
  tags?: string[];
};

// The subset of Entry fields a version snapshot cares about — everything a
// user can edit via EntryForm, excluding id/timestamps/relations.
type EntrySnapshotData = {
  title: string;
  displayTitle: string | null;
  organization: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  url: string | null;
  bullets: string[];
  tags: string[];
  categoryId: string;
};

// Treats an empty string the same as "not provided" for every optional text
// field below. The web form's own actions.ts already does this itself
// before calling create/updateEntryForUser (`(formData.get(...) as string)
// || null`), but the MCP update_entry/create_entry tools pass their input
// straight through — entryCoreFieldsSchema's zod shape allows "" (it's
// .optional(), not .min(1)), so an agent-driven call with e.g.
// organization: "" used to leave a bare `?? null` (which only catches
// undefined) storing "" verbatim. That diverged from the web path's data
// and, worse, made EntryHistory's diff view flag the field as "changed"
// between a prior null and a new "" even though both render identically as
// "—" — a changed-with-no-visible-difference badge. Normalizing once here,
// for every caller, keeps web and MCP writes identical and keeps that diff
// meaningful.
function emptyToNull(value: string | null | undefined): string | null {
  return value || null;
}

function snapshotFields(entry: Entry): EntrySnapshotData {
  return {
    title: entry.title,
    displayTitle: entry.displayTitle,
    organization: entry.organization,
    location: entry.location,
    startDate: entry.startDate,
    endDate: entry.endDate,
    description: entry.description,
    url: entry.url,
    bullets: entry.bullets,
    tags: entry.tags,
    categoryId: entry.categoryId,
  };
}

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
      displayTitle: emptyToNull(data.displayTitle),
      organization: emptyToNull(data.organization),
      location: emptyToNull(data.location),
      startDate: emptyToNull(data.startDate),
      endDate: emptyToNull(data.endDate),
      description: emptyToNull(data.description),
      url: emptyToNull(data.url),
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
  opts?: { categoryId?: string; tag?: string }
): Promise<Entry[]> {
  return prisma.entry.findMany({
    where: {
      userId,
      ...(opts?.categoryId ? { categoryId: opts.categoryId } : {}),
      ...(opts?.tag ? { tags: { has: opts.tag } } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getEntryForUser(
  userId: string,
  entryId: string
): Promise<Entry | null> {
  return prisma.entry.findFirst({ where: { id: entryId, userId } });
}

export type UpdateEntryResult = { ok: true } | { ok: false };

/**
 * Updates an Entry, first snapshotting its pre-update field values into
 * EntryVersion (GitHub issue #26: "all resume entries should have
 * history") — skipped when the edit is a no-op, so clicking Save without
 * changing anything doesn't pile up identical history rows.
 */
export async function updateEntryForUser(
  userId: string,
  entryId: string,
  data: EntryInput
): Promise<UpdateEntryResult> {
  const existing = await prisma.entry.findFirst({ where: { id: entryId, userId } });
  if (!existing) return { ok: false };

  const next: EntrySnapshotData = {
    title: data.title,
    displayTitle: emptyToNull(data.displayTitle),
    organization: emptyToNull(data.organization),
    location: emptyToNull(data.location),
    startDate: emptyToNull(data.startDate),
    endDate: emptyToNull(data.endDate),
    description: emptyToNull(data.description),
    url: emptyToNull(data.url),
    bullets: data.bullets ?? [],
    tags: data.tags ?? [],
    categoryId: data.categoryId,
  };
  const previous = snapshotFields(existing);
  const changed = JSON.stringify(previous) !== JSON.stringify(next);

  await prisma.$transaction([
    ...(changed
      ? [
          prisma.entryVersion.create({
            data: { entryId, userId, data: previous },
          }),
        ]
      : []),
    prisma.entry.updateMany({
      where: { id: entryId, userId },
      data: next,
    }),
  ]);

  return { ok: true };
}

export async function listEntryVersionsForUser(
  userId: string,
  entryId: string
): Promise<EntryVersion[]> {
  return prisma.entryVersion.findMany({
    where: { entryId, userId },
    orderBy: { createdAt: "desc" },
  });
}

export function entryLabel(entry: { title: string; displayTitle: string | null }): string {
  return entry.displayTitle || entry.title;
}
