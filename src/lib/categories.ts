import { prisma } from "@/lib/prisma";
import type { Category } from "@prisma/client";

export async function listCategoriesForUser(userId: string): Promise<Category[]> {
  return prisma.category.findMany({
    where: { OR: [{ userId: null }, { userId }] },
    orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
  });
}
