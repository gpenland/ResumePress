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

// Case-folds a status against the suggested list (e.g. "interviewing" ->
// "Interviewing") so the pipeline stats and Sankey flow view don't silently
// split a status across two casings (GitHub issue #96 — the MCP tools are
// the main way a status can arrive in an unexpected casing, since the web
// form's own StatusSelect only ever submits one of APPLICATION_STATUSES
// verbatim). Anything that doesn't match one of the suggested statuses is
// returned unchanged — status stays a free-form string by design (see the
// comment on APPLICATION_STATUSES above); this only normalizes casing for
// values that were clearly meant to be one of the suggested ones.
export function normalizeStatus(status: string): string {
  const trimmed = status.trim();
  const match = APPLICATION_STATUSES.find((s) => s.toLowerCase() === trimmed.toLowerCase());
  return match ?? trimmed;
}

// Shared between suggestApplicationStatusForUser (applications.ts, on-demand
// "Suggest status" button) and the eager per-thread classification in
// emailThreads.ts's sync — both ask Jev to choose a status from the same
// rubric, just over different evidence (an application's recent confirmed
// email interactions vs. one specific thread's own content).
export const STATUS_DESCRIPTIONS: Record<ApplicationStatus, string> = {
  Applied: "Submitted the application; no response yet",
  OA: "Received an online assessment or coding test to complete",
  Interviewing: "In the interview process (phone screen, onsite, etc.)",
  Offer: "Received a job offer",
  Rejected: "Rejected, or explicitly turned down",
  Ghosted: "No response for a long time after applying or interviewing",
};

export type ApplicationWithCompany = Application & { company: Company };

// Single source of truth for status color: each status maps to one semantic
// tone, and that tone drives both StatusBadge's bg/text classes and
// ApplicationStatusSankey's fill classes, so the two can't drift out of sync.
type StatusTone = "slate" | "blue" | "violet" | "amber" | "emerald" | "destructive" | "muted";

const STATUS_TONES: Record<string, StatusTone> = {
  Applied: "blue",
  OA: "violet",
  Interviewing: "amber",
  Offer: "emerald",
  Rejected: "destructive",
  Ghosted: "muted",
};

// Also used for the Sankey's synthetic "Start" node and any unrecognized status.
const DEFAULT_TONE: StatusTone = "slate";

const TONE_BADGE_CLASSES: Record<StatusTone, string> = {
  slate: "bg-muted text-muted-foreground",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

const TONE_FILL_CLASSES: Record<StatusTone, string> = {
  slate: "fill-slate-400 dark:fill-slate-500",
  blue: "fill-blue-500 dark:fill-blue-400",
  violet: "fill-violet-500 dark:fill-violet-400",
  amber: "fill-amber-500 dark:fill-amber-400",
  emerald: "fill-emerald-500 dark:fill-emerald-400",
  destructive: "fill-destructive",
  muted: "fill-muted-foreground",
};

// Solid-background counterpart of TONE_FILL_CLASSES, for HTML (not SVG) bars —
// see the dashboard Statistics panel's status-breakdown chart.
const TONE_BAR_CLASSES: Record<StatusTone, string> = {
  slate: "bg-slate-400 dark:bg-slate-500",
  blue: "bg-blue-500 dark:bg-blue-400",
  violet: "bg-violet-500 dark:bg-violet-400",
  amber: "bg-amber-500 dark:bg-amber-400",
  emerald: "bg-emerald-500 dark:bg-emerald-400",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground",
};

function toneFor(status: string): StatusTone {
  return STATUS_TONES[status] ?? DEFAULT_TONE;
}

export function statusBadgeClasses(status: string): string {
  return TONE_BADGE_CLASSES[toneFor(status)];
}

export function statusFillClass(status: string): string {
  return TONE_FILL_CLASSES[toneFor(status)];
}

export function statusBarClass(status: string): string {
  return TONE_BAR_CLASSES[toneFor(status)];
}

// Shared date formatting for application dates (e.g. "Applied Jan 5, 2026").
export function formatShortDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
