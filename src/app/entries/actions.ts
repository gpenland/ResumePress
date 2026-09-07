"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";

export async function createEntry(formData: FormData) {
  const userId = await requireUserId();
  const categoryId = formData.get("categoryId") as string;

  const category = await prisma.category.findFirst({
    where: { id: categoryId, OR: [{ userId: null }, { userId }] },
  });
  if (!category) notFound();

  const bullets = parseBullets(formData.get("bullets") as string);
  const tags = parseTags(formData.get("tags") as string);

  const entry = await prisma.entry.create({
    data: {
      title: formData.get("title") as string,
      pdfTitle: (formData.get("pdfTitle") as string) || null,
      organization: (formData.get("organization") as string) || null,
      location: (formData.get("location") as string) || null,
      startDate: (formData.get("startDate") as string) || null,
      endDate: (formData.get("endDate") as string) || null,
      description: (formData.get("description") as string) || null,
      url: (formData.get("url") as string) || null,
      bullets,
      tags,
      categoryId,
      userId,
    },
  });

  revalidatePath("/entries");
  revalidatePath("/");
  redirect(`/entries/${entry.id}/edit`);
}

export async function updateEntry(id: string, formData: FormData) {
  const userId = await requireUserId();
  const bullets = parseBullets(formData.get("bullets") as string);
  const tags = parseTags(formData.get("tags") as string);

  const { count } = await prisma.entry.updateMany({
    where: { id, userId },
    data: {
      title: formData.get("title") as string,
      pdfTitle: (formData.get("pdfTitle") as string) || null,
      organization: (formData.get("organization") as string) || null,
      location: (formData.get("location") as string) || null,
      startDate: (formData.get("startDate") as string) || null,
      endDate: (formData.get("endDate") as string) || null,
      description: (formData.get("description") as string) || null,
      url: (formData.get("url") as string) || null,
      bullets,
      tags,
      categoryId: formData.get("categoryId") as string,
    },
  });
  if (count === 0) notFound();

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
