"use server";

import { requireUserId } from "@/lib/auth";
import { disconnectGmailAccount } from "@/lib/gmailAccount";
import {
  updateSyncLabelsForUser,
  syncGmailForUser,
  confirmEmailThreadMatchForUser,
  ignoreEmailThreadMatchForUser,
  restoreEmailThreadMatchForUser,
  type SyncResult,
} from "@/lib/emailThreads";
import { createContactForUser } from "@/lib/contacts";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

export async function disconnectGmail() {
  const userId = await requireUserId();
  await disconnectGmailAccount(userId);
  revalidatePath("/email");
}

export async function saveGmailSyncLabels(formData: FormData) {
  const userId = await requireUserId();
  const labelIds = formData.getAll("labelIds").map(String);
  await updateSyncLabelsForUser(userId, labelIds);
  revalidatePath("/email");
}

export async function syncGmailNow(): Promise<SyncResult> {
  const userId = await requireUserId();
  const result = await syncGmailForUser(userId);
  revalidatePath("/email");
  return result;
}

export async function confirmEmailThreadMatch(
  threadId: string,
  contactId: string | null,
  applicationId: string | null
) {
  const userId = await requireUserId();
  const result = await confirmEmailThreadMatchForUser(userId, threadId, contactId, applicationId);
  if (!result.ok) notFound();

  revalidatePath("/email");
}

export async function ignoreEmailThreadMatch(threadId: string) {
  const userId = await requireUserId();
  const result = await ignoreEmailThreadMatchForUser(userId, threadId);
  if (!result.ok) notFound();

  revalidatePath("/email");
}

export async function restoreEmailThreadMatch(threadId: string) {
  const userId = await requireUserId();
  const result = await restoreEmailThreadMatchForUser(userId, threadId);
  if (!result.ok) notFound();

  revalidatePath("/email");
}

// Barebones contact creation from an unmatched triage thread — name + the one
// sender email picked from the thread's participants, nothing else. Doesn't
// confirm the thread's match itself; the caller still picks the new contact
// in the row's select and hits Confirm, same as any other match.
export async function createContactFromTriage(name: string, email: string | null) {
  const userId = await requireUserId();
  const contact = await createContactForUser(userId, { name, emails: email ? [email] : [] });

  revalidatePath("/email");
  revalidatePath("/contacts");
  return { id: contact.id, name: contact.name };
}
