import { prisma } from "@/lib/prisma";
import type { Company } from "@prisma/client";

export * from "./companiesShared";

export async function listCompaniesForUser(userId: string): Promise<Company[]> {
  return prisma.company.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
}

export async function getCompanyForUser(userId: string, companyId: string): Promise<Company | null> {
  return prisma.company.findFirst({ where: { id: companyId, userId } });
}

/**
 * Applications are created via a free-text company name (see ApplicationForm's
 * datalist). Reuse an existing company with a case-insensitive exact name match
 * instead of creating duplicates every time the same company is typed.
 */
export async function findOrCreateCompanyForUser(userId: string, name: string): Promise<Company> {
  const trimmed = name.trim();
  const existing = await prisma.company.findFirst({
    where: { userId, name: { equals: trimmed, mode: "insensitive" } },
  });
  if (existing) return existing;

  return prisma.company.create({
    data: { name: trimmed, userId },
  });
}

