"use server";

import { requireUserId } from "@/lib/auth";
import {
  confirmEmailThreadMatchForUser,
  ignoreEmailThreadMatchForUser,
  restoreEmailThreadMatchForUser,
} from "@/lib/emailThreads";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

export async function confirmEmailThreadMatch(
  threadId: string,
  contactId: string | null,
  applicationId: string | null
) {
  const userId = await requireUserId();
  const result = await confirmEmailThreadMatchForUser(userId, threadId, contactId, applicationId);
  if (!result.ok) notFound();

  revalidatePath("/triage");
}

export async function ignoreEmailThreadMatch(threadId: string) {
  const userId = await requireUserId();
  const result = await ignoreEmailThreadMatchForUser(userId, threadId);
  if (!result.ok) notFound();

  revalidatePath("/triage");
}

export async function restoreEmailThreadMatch(threadId: string) {
  const userId = await requireUserId();
  const result = await restoreEmailThreadMatchForUser(userId, threadId);
  if (!result.ok) notFound();

  revalidatePath("/triage");
}
