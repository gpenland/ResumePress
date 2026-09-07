import { prisma } from "@/lib/prisma";
import type { Resume } from "@prisma/client";

export type ResumeIdentity = {
  name: string;
  email: string;
  phone?: string;
  website?: string;
  linkedin?: string;
  github?: string;
};

export type ResumeInput = {
  name: string;
  templateId?: string;
  identity: ResumeIdentity;
};

export async function createResumeForUser(
  userId: string,
  data: ResumeInput
): Promise<Resume> {
  return prisma.resume.create({
    data: {
      name: data.name,
      templateId: data.templateId ?? "jake",
      identity: {
        name: data.identity.name,
        email: data.identity.email,
        phone: data.identity.phone ?? "",
        website: data.identity.website ?? "",
        linkedin: data.identity.linkedin ?? "",
        github: data.identity.github ?? "",
      },
      userId,
    },
  });
}

export async function listResumesForUser(userId: string): Promise<Resume[]> {
  return prisma.resume.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getResumeForUser(userId: string, resumeId: string) {
  return prisma.resume.findFirst({
    where: { id: resumeId, userId },
    include: {
      entries: {
        orderBy: { order: "asc" },
        include: { entry: { include: { category: true } } },
      },
    },
  });
}
