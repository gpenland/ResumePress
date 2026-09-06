"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createResume(formData: FormData) {
  const identity = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    phone: (formData.get("phone") as string) || "",
    website: (formData.get("website") as string) || "",
    linkedin: (formData.get("linkedin") as string) || "",
    github: (formData.get("github") as string) || "",
  };

  const resume = await prisma.resume.create({
    data: {
      name: formData.get("resumeName") as string,
      templateId: (formData.get("templateId") as string) || "jake",
      identity,
    },
  });

  revalidatePath("/resumes");
  revalidatePath("/");
  redirect(`/resumes/${resume.id}`);
}

export async function updateResumeIdentity(resumeId: string, formData: FormData) {
  const identity = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    phone: (formData.get("phone") as string) || "",
    website: (formData.get("website") as string) || "",
    linkedin: (formData.get("linkedin") as string) || "",
    github: (formData.get("github") as string) || "",
  };

  await prisma.resume.update({
    where: { id: resumeId },
    data: {
      name: formData.get("resumeName") as string,
      identity,
    },
  });

  revalidatePath(`/resumes/${resumeId}`);
}

export async function updateResumeEntries(
  resumeId: string,
  selectedEntryIds: string[]
) {
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
  await prisma.resume.delete({ where: { id } });
  revalidatePath("/resumes");
  revalidatePath("/");
  redirect("/resumes");
}
