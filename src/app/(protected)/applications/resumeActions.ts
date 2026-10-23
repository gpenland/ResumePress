"use server";

// Module D's own file, separate from ../actions.ts (Module A's), per
// docs/MIGRATION_PLAN.md §5's "avoid two agents editing the same file."

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { createResumeSnapshotForUser } from "@/lib/resumes";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

// Attaching (or re-attaching, e.g. via the "Refresh" action) always freezes
// a fresh ResumeSnapshot — see createResumeSnapshotForUser. GitHub issue
// #26: the application must keep pointing at the resume content as it was
// at attach time, not drift if the resume's entries are edited afterward.
export async function attachResumeToApplication(applicationId: string, resumeId: string) {
  const userId = await requireUserId();

  const snapshot = await createResumeSnapshotForUser(userId, resumeId);
  if (!snapshot) notFound();

  const { count } = await prisma.application.updateMany({
    where: { id: applicationId, userId },
    data: { resumeId, resumeSnapshotId: snapshot.id },
  });
  if (count === 0) notFound();

  revalidatePath(`/applications/${applicationId}`);
}

export async function detachResumeFromApplication(applicationId: string) {
  const userId = await requireUserId();

  const { count } = await prisma.application.updateMany({
    where: { id: applicationId, userId },
    data: { resumeId: null, resumeSnapshotId: null },
  });
  if (count === 0) notFound();

  revalidatePath(`/applications/${applicationId}`);
}
