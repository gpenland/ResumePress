// Pure constant, safe for client components to import without bundling the
// Prisma client (see applicationsShared.ts for why this split exists).
export const INTERACTION_TYPES = [
  "Email",
  "Call",
  "Meeting",
  "Career Fair",
  "Coffee Chat",
  "LinkedIn",
  "Other",
] as const;

export type InteractionType = (typeof INTERACTION_TYPES)[number];
