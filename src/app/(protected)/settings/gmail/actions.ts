"use server";

import { requireUserId } from "@/lib/auth";
import { disconnectGmailAccount } from "@/lib/gmailAccount";
import { updateSyncLabelsForUser, syncGmailForUser, type SyncResult } from "@/lib/emailThreads";
import { revalidatePath } from "next/cache";

export async function disconnectGmail() {
  const userId = await requireUserId();
  await disconnectGmailAccount(userId);
  revalidatePath("/settings/gmail");
}

export async function saveGmailSyncLabels(formData: FormData) {
  const userId = await requireUserId();
  const labelIds = formData.getAll("labelIds").map(String);
  await updateSyncLabelsForUser(userId, labelIds);
  revalidatePath("/settings/gmail");
}

export async function syncGmailNow(): Promise<SyncResult> {
  const userId = await requireUserId();
  const result = await syncGmailForUser(userId);
  revalidatePath("/settings/gmail");
  revalidatePath("/triage");
  return result;
}
