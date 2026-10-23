"use server";

// Module D's own file, separate from ../actions.ts (Module A's), per
// docs/MIGRATION_PLAN.md §5's "avoid two agents editing the same file."

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

export async function attachResumeToApplication(applicationId: string, resumeId: string) {
  const userId = await requireUserId();

  const resume = await prisma.resume.findFirst({ where: { id: resumeId, userId } });
  if (!resume) notFound();

  const { count } = await prisma.application.updateMany({
    where: { id: applicationId, userId },
    data: { resumeId },
  });
  if (count === 0) notFound();

  revalidatePath(`/applications/${applicationId}`);
}

export async function detachResumeFromApplication(applicationId: string) {
  const userId = await requireUserId();

  const { count } = await prisma.application.updateMany({
    where: { id: applicationId, userId },
    data: { resumeId: null },
  });
  if (count === 0) notFound();

  revalidatePath(`/applications/${applicationId}`);
}
