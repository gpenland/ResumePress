"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { generateApiToken } from "@/lib/apiToken";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

export async function createApiToken(
  name: string
): Promise<{ id: string; token: string }> {
  const userId = await requireUserId();
  const { token, tokenHash } = generateApiToken();

  const apiToken = await prisma.apiToken.create({
    data: { userId, name, tokenHash },
  });

  revalidatePath("/settings/tokens");
  return { id: apiToken.id, token };
}

export async function revokeApiToken(id: string) {
  const userId = await requireUserId();
  const { count } = await prisma.apiToken.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) notFound();
  revalidatePath("/settings/tokens");
}
