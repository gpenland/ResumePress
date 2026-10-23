"use server";

import { requireUserId } from "@/lib/auth";
import { importMappedApplicationsForUser } from "@/lib/applications";
import type { MappedApplicationRow } from "@/lib/notionImportShared";
import { revalidatePath } from "next/cache";

// Defensive cap against a huge/malformed paste locking up the request —
// nothing about a personal job-tracker import should ever need this many
// rows in one file. Flagged by the Phase 4 audit as unbounded.
const MAX_IMPORT_ROWS = 2000;

export async function importNotionApplications(rows: MappedApplicationRow[]) {
  const userId = await requireUserId();
  const result = await importMappedApplicationsForUser(userId, rows.slice(0, MAX_IMPORT_ROWS));
  revalidatePath("/applications");
  return result;
}
