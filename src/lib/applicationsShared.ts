// Pure constants/types shared between server code (src/lib/applications.ts)
// and client components (StatusSelect, ApplicationsList, ApplicationsKanban).
// Deliberately has no runtime import of @/lib/prisma — only type-only imports
// from @prisma/client, which are erased at compile time — so client
// components can import from here without bundling the Prisma client.

import type { Application, Company } from "@prisma/client";

// Suggested statuses from PLAN.md §3, trimmed per GitHub issue #17 (fewer
// statuses; use status-history notes for anything finer-grained). Stored as a
// free-form string column (not an enum), so this list is a UI affordance, not
// a DB constraint — importers and future custom statuses aren't blocked by it.
export const APPLICATION_STATUSES = [
  "Applied",
  "OA",
  "Interviewing",
  "Offer",
  "Rejected",
  "Ghosted",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type ApplicationWithCompany = Application & { company: Company };
