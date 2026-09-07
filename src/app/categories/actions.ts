"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

export async function createCategory(formData: FormData) {
  const userId = await requireUserId();
  const name = formData.get("name") as string;
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  await prisma.category.create({
    data: { name, slug, isBuiltIn: false, userId },
  });

  revalidatePath("/categories");
}

export async function deleteCategory(id: string) {
  const userId = await requireUserId();
  const { count } = await prisma.category.deleteMany({
    where: { id, userId, isBuiltIn: false },
  });
  if (count === 0) notFound();
  revalidatePath("/categories");
}
