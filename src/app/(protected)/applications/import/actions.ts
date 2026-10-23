"use server";

import { requireUserId } from "@/lib/auth";
import { importMappedApplicationsForUser } from "@/lib/applications";
import type { MappedApplicationRow } from "@/lib/notionImportShared";
import { revalidatePath } from "next/cache";

export async function importNotionApplications(rows: MappedApplicationRow[]) {
  const userId = await requireUserId();
  const result = await importMappedApplicationsForUser(userId, rows);
  revalidatePath("/applications");
  return result;
}
