"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { createResumeForUser } from "@/lib/resumes";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";

export async function createResume(formData: FormData) {
  const userId = await requireUserId();
  const identity = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    phone: (formData.get("phone") as string) || "",
    website: (formData.get("website") as string) || "",
    linkedin: (formData.get("linkedin") as string) || "",
    github: (formData.get("github") as string) || "",
  };

  const resume = await createResumeForUser(userId, {
    name: formData.get("resumeName") as string,
    templateId: (formData.get("templateId") as string) || "jake",
    identity,
  });

  revalidatePath("/resumes");
  revalidatePath("/");
  redirect(`/resumes/${resume.id}`);
}

export async function updateResumeIdentity(resumeId: string, formData: FormData) {
  const userId = await requireUserId();
  const identity = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    phone: (formData.get("phone") as string) || "",
    website: (formData.get("website") as string) || "",
    linkedin: (formData.get("linkedin") as string) || "",
    github: (formData.get("github") as string) || "",
  };

  const { count } = await prisma.resume.updateMany({
    where: { id: resumeId, userId },
    data: {
      name: formData.get("resumeName") as string,
      identity,
    },
  });
  if (count === 0) notFound();

  revalidatePath(`/resumes/${resumeId}`);
}

export async function updateResumeEntries(
  resumeId: string,
  selectedEntryIds: string[]
) {
  const userId = await requireUserId();

  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId },
    select: { id: true },
  });
  if (!resume) notFound();

  if (selectedEntryIds.length > 0) {
    const owned = await prisma.entry.count({
      where: { id: { in: selectedEntryIds }, userId },
    });
    if (owned !== selectedEntryIds.length) {
      throw new Error("One or more selected entries are invalid.");
    }
  }

  await prisma.$transaction([
    prisma.resumeEntry.deleteMany({ where: { resumeId } }),
    prisma.resumeEntry.createMany({
      data: selectedEntryIds.map((entryId, order) => ({
        resumeId,
        entryId,
        order,
      })),
    }),
  ]);

  revalidatePath(`/resumes/${resumeId}`);
}

export async function deleteResume(id: string) {
  const userId = await requireUserId();
  const { count } = await prisma.resume.deleteMany({ where: { id, userId } });
  if (count === 0) notFound();
  revalidatePath("/resumes");
  revalidatePath("/");
  redirect("/resumes");
}
