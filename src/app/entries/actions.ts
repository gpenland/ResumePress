"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createEntry(formData: FormData) {
  const bullets = parseBullets(formData.get("bullets") as string);
  const tags = parseTags(formData.get("tags") as string);

  const entry = await prisma.entry.create({
    data: {
      title: formData.get("title") as string,
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

  revalidatePath("/entries");
  revalidatePath("/");
  redirect(`/entries/${entry.id}/edit`);
}

export async function updateEntry(id: string, formData: FormData) {
  const bullets = parseBullets(formData.get("bullets") as string);
  const tags = parseTags(formData.get("tags") as string);

  await prisma.entry.update({
    where: { id },
    data: {
      title: formData.get("title") as string,
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

  revalidatePath("/entries");
  revalidatePath(`/entries/${id}/edit`);
  revalidatePath("/");
}

export async function deleteEntry(id: string) {
  await prisma.entry.delete({ where: { id } });
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
