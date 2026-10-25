"use server";

import { requireUserId } from "@/lib/auth";
import {
  confirmEmailThreadMatchForUser,
  ignoreEmailThreadMatchForUser,
  restoreEmailThreadMatchForUser,
} from "@/lib/emailThreads";
import { createContactForUser } from "@/lib/contacts";
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

// Barebones contact creation from an unmatched triage thread — name + the one
// sender email picked from the thread's participants, nothing else. Doesn't
// confirm the thread's match itself; the caller still picks the new contact
// in the row's select and hits Confirm, same as any other match.
export async function createContactFromTriage(name: string, email: string | null) {
  const userId = await requireUserId();
  const contact = await createContactForUser(userId, { name, emails: email ? [email] : [] });

  revalidatePath("/triage");
  revalidatePath("/contacts");
  return { id: contact.id, name: contact.name };
}
