"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { createEntryForUser, getEntryForUser, updateEntryForUser } from "@/lib/entries";
import { askJev } from "@/lib/jev";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";

export async function createEntry(formData: FormData) {
  const userId = await requireUserId();
  const categoryId = formData.get("categoryId") as string;
  const bullets = parseBullets(formData.get("bullets") as string);
  const tags = parseTags(formData.get("tags") as string);

  const result = await createEntryForUser(userId, {
    title: formData.get("title") as string,
    categoryId,
    displayTitle: (formData.get("displayTitle") as string) || null,
    organization: (formData.get("organization") as string) || null,
    location: (formData.get("location") as string) || null,
    startDate: (formData.get("startDate") as string) || null,
    endDate: (formData.get("endDate") as string) || null,
    description: (formData.get("description") as string) || null,
    url: (formData.get("url") as string) || null,
    bullets,
    tags,
  });
  if (!result.ok) notFound();

  revalidatePath("/entries");
  revalidatePath("/");
  redirect(`/entries/${result.entry.id}/edit`);
}

export async function cloneEntry(id: string) {
  const userId = await requireUserId();
  const source = await getEntryForUser(userId, id);
  if (!source) notFound();

  const result = await createEntryForUser(userId, {
    title: `${source.title} (Copy)`,
    categoryId: source.categoryId,
    displayTitle: source.displayTitle,
    organization: source.organization,
    location: source.location,
    startDate: source.startDate,
    endDate: source.endDate,
    description: source.description,
    url: source.url,
    bullets: source.bullets,
    tags: source.tags,
  });
  if (!result.ok) notFound();

  revalidatePath("/entries");
  revalidatePath("/");
  redirect(`/entries/${result.entry.id}/edit`);
}

export async function updateEntry(id: string, formData: FormData) {
  const userId = await requireUserId();
  const bullets = parseBullets(formData.get("bullets") as string);
  const tags = parseTags(formData.get("tags") as string);

  const result = await updateEntryForUser(userId, id, {
    title: formData.get("title") as string,
    categoryId: formData.get("categoryId") as string,
    displayTitle: (formData.get("displayTitle") as string) || null,
    organization: (formData.get("organization") as string) || null,
    location: (formData.get("location") as string) || null,
    startDate: (formData.get("startDate") as string) || null,
    endDate: (formData.get("endDate") as string) || null,
    description: (formData.get("description") as string) || null,
    url: (formData.get("url") as string) || null,
    bullets,
    tags,
  });
  if (!result.ok) notFound();

  revalidatePath("/entries");
  revalidatePath(`/entries/${id}/edit`);
  revalidatePath("/");
}

export async function deleteEntry(id: string) {
  const userId = await requireUserId();
  const { count } = await prisma.entry.deleteMany({ where: { id, userId } });
  if (count === 0) notFound();
  revalidatePath("/entries");
  revalidatePath("/");
  redirect("/entries");
}

export async function scoreBulletText(
  text: string
): Promise<{ ok: true; score: number; confidence: number; legend: Record<string, string> } | { ok: false; error: string }> {
  await requireUserId();

  const result = await askJev(text, {
    xyz: {
      type: "score",
      instructions:
        "Rate this resume bullet point on the XYZ framework (Accomplished X, as measured by Y, by doing Z).",
      criteria: [
        "No measurable outcome and no specific method — a generic duty description",
        "Has either a quantified/measurable result OR a specific method/mechanism, but not both",
        "Full XYZ: a quantified or clearly measurable outcome AND the specific method used to achieve it",
      ],
    },
  });

  if (!result.ok) return result;

  const { xyz } = result.answers;
  if (xyz.type !== "score") return { ok: false, error: "Unexpected response from Jev." };

  return { ok: true, score: xyz.score, confidence: xyz.confidence, legend: xyz.legend };
}

function parseBullets(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
