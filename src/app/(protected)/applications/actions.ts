"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import {
  createApplicationForUser,
  updateApplicationForUser,
  updateApplicationStatusForUser,
  logApplicationUpdateForUser,
  setApplicationHistoryNoteForUser,
  deleteApplicationStatusHistoryEntryForUser,
  bulkUpdateApplicationStatusForUser,
  bulkDeleteApplicationsForUser,
  type ApplicationInput,
} from "@/lib/applications";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";

function inputFromFormData(formData: FormData): ApplicationInput {
  return {
    companyName: formData.get("companyName") as string,
    roleTitle: formData.get("roleTitle") as string,
    term: (formData.get("term") as string) || null,
    status: (formData.get("status") as string) || undefined,
    appliedAt: (formData.get("appliedAt") as string) || null,
    postingUrl: (formData.get("postingUrl") as string) || null,
    location: (formData.get("location") as string) || null,
    source: (formData.get("source") as string) || null,
    notes: (formData.get("notes") as string) || null,
  };
}

export async function createApplication(formData: FormData) {
  const userId = await requireUserId();
  const application = await createApplicationForUser(userId, inputFromFormData(formData));

  revalidatePath("/applications");
  redirect(`/applications/${application.id}`);
}

export async function updateApplication(id: string, formData: FormData) {
  const userId = await requireUserId();
  const result = await updateApplicationForUser(userId, id, inputFromFormData(formData));
  if (!result.ok) notFound();

  revalidatePath("/applications");
  revalidatePath(`/applications/${id}`);
  redirect(`/applications/${id}`);
}

export async function updateApplicationStatus(id: string, status: string) {
  const userId = await requireUserId();
  const result = await updateApplicationStatusForUser(userId, id, status);
  if (!result.ok) notFound();

  revalidatePath("/applications");
  revalidatePath(`/applications/${id}`);
}

/** Logs a note-only history entry without changing status (issue #17). */
export async function logApplicationUpdate(applicationId: string, note: string) {
  const userId = await requireUserId();
  const result = await logApplicationUpdateForUser(userId, applicationId, note);
  if (!result.ok) notFound();

  revalidatePath(`/applications/${applicationId}`);
}

/** Adds or edits the note on an existing status-history entry. */
export async function setApplicationHistoryNote(applicationId: string, historyId: string, note: string) {
  const userId = await requireUserId();
  const result = await setApplicationHistoryNoteForUser(userId, historyId, note);
  if (!result.ok) notFound();

  revalidatePath(`/applications/${applicationId}`);
}

/** Deletes the most recent status-history entry, reverting status if it was a real change. */
export async function deleteApplicationStatusHistoryEntry(applicationId: string, historyId: string) {
  const userId = await requireUserId();
  const result = await deleteApplicationStatusHistoryEntryForUser(userId, applicationId, historyId);
  if (!result.ok) notFound();

  revalidatePath("/applications");
  revalidatePath(`/applications/${applicationId}`);
}

export async function deleteApplication(id: string) {
  const userId = await requireUserId();
  const { count } = await prisma.application.deleteMany({ where: { id, userId } });
  if (count === 0) notFound();

  revalidatePath("/applications");
  redirect("/applications");
}

export async function bulkUpdateApplicationStatus(ids: string[], status: string) {
  const userId = await requireUserId();
  await bulkUpdateApplicationStatusForUser(userId, ids, status);
  revalidatePath("/applications");
}

export async function bulkDeleteApplications(ids: string[]) {
  const userId = await requireUserId();
  await bulkDeleteApplicationsForUser(userId, ids);
  revalidatePath("/applications");
}
