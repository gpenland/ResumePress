"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import {
  createApplicationForUser,
  updateApplicationForUser,
  updateApplicationStatusForUser,
  importApplicationCsvRowsForUser,
  parseApplicationsCsv,
  type ApplicationInput,
  type ApplicationCsvRow,
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
    deadline: (formData.get("deadline") as string) || null,
    postingUrl: (formData.get("postingUrl") as string) || null,
    location: (formData.get("location") as string) || null,
    source: (formData.get("source") as string) || null,
    priority: (formData.get("priority") as string) || null,
    nextFollowUpAt: (formData.get("nextFollowUpAt") as string) || null,
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

export async function deleteApplication(id: string) {
  const userId = await requireUserId();
  const { count } = await prisma.application.deleteMany({ where: { id, userId } });
  if (count === 0) notFound();

  revalidatePath("/applications");
  redirect("/applications");
}

export type ImportCsvResult =
  | { ok: true; imported: number }
  | { ok: false; errors: string[] };

/** Commits a dry-run-previewed CSV import. Re-parses server-side rather than
 * trusting the client's parse, since the client preview is just UX. */
export async function importApplicationsCsv(csvText: string): Promise<ImportCsvResult> {
  const userId = await requireUserId();
  const { rows, errors } = parseApplicationsCsv(csvText);
  if (errors.length > 0 && rows.length === 0) {
    return { ok: false, errors };
  }

  const { imported } = await importApplicationCsvRowsForUser(userId, rows as ApplicationCsvRow[]);
  revalidatePath("/applications");
  return { ok: true, imported };
}
