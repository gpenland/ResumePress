// Pure, client-safe helpers for GitHub issue #106's recruiting-cycle filter.
// No dedicated DB field: Application.term stays free text (the issue itself
// asks for "the path of least resistance"), and a cycle is derived on read
// from term, falling back to appliedAt when term is empty or unparseable.
//
// A "cycle" is named by its Fall's calendar year — e.g. the "2026" cycle
// covers Fall 2026, Spring 2027, and Summer 2027 (internships running
// roughly August 2026 - August 2027), since Spring/Summer following a Fall
// belong to that same recruiting cycle, not the next one.

const SEASON = "(fall|spring|summer)";
const YEAR = "(\\d{4}|\\d{2})";
// Season and year must sit next to each other (up to 15 non-digit
// characters apart, to tolerate "Fall of '26", "Fall, 2026", etc.) rather
// than being found independently anywhere in the string — an earlier
// version matched a season word and the *first* 2-or-4-digit number in the
// whole term separately, which misparsed something like "12-week Fall 2026
// internship" as the year 12 (from "12-week") instead of 2026. Checked in
// both orders since "2026 Fall" is also plausible input.
const SEASON_THEN_YEAR_RE = new RegExp(`\\b${SEASON}\\b[^0-9]{0,15}${YEAR}\\b`, "i");
const YEAR_THEN_SEASON_RE = new RegExp(`\\b${YEAR}\\b[^0-9]{0,15}${SEASON}\\b`, "i");

type Season = "Fall" | "Spring" | "Summer";

function normalizeYear(raw: string): number {
  return raw.length === 2 ? 2000 + parseInt(raw, 10) : parseInt(raw, 10);
}

function toSeason(raw: string): Season {
  return (raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()) as Season;
}

// Spring/Summer belong to the cycle whose Fall preceded them.
function cycleYearForSeason(season: Season, year: number): number {
  return season === "Fall" ? year : year - 1;
}

// Parses free text like "Summer 2027", "fall 26", "Spring '27" into a cycle
// year. Returns null when the text has no recognizable season+year pair
// (callers fall back to appliedAt in that case).
export function parseTermToCycle(term: string | null | undefined): number | null {
  if (!term) return null;
  const forward = term.match(SEASON_THEN_YEAR_RE);
  if (forward) return cycleYearForSeason(toSeason(forward[1]), normalizeYear(forward[2]));
  const backward = term.match(YEAR_THEN_SEASON_RE);
  if (backward) return cycleYearForSeason(toSeason(backward[2]), normalizeYear(backward[1]));
  return null;
}

// Maps an arbitrary date to the cycle someone would be applying for at that
// time. Per the issue, a "Fall Y" cycle is typically applied to between the
// start of summer and the end of the next spring (roughly May Y - April
// (Y+1)) — so Jan-Apr belongs to the PRIOR Fall's cycle, not the calendar
// year's own Fall. This is also what makes "current cycle" correct during
// the summer: e.g. June of year Y resolves to cycle Y (next Fall), not
// whatever cycle included the summer just gone (which would be Y-1).
//
// Uses UTC, not local time: appliedAt comes from a date-only <input
// type="date"> (toDate() in applications.ts parses "YYYY-MM-DD" with
// `new Date(value)`, which the spec defines as UTC midnight for a date-only
// string) — extracting the calendar month/year with local-time getters would
// shift that date backward a day on any server whose local timezone trails
// UTC, misclassifying dates right at the May/April cycle boundary.
export function cycleForDate(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-indexed; Jan=0 ... Apr=3, May=4
  return month < 4 ? year - 1 : year;
}

export function cycleForApplication(
  term: string | null | undefined,
  appliedAt: Date | string | null | undefined
): number | null {
  const fromTerm = parseTermToCycle(term);
  if (fromTerm !== null) return fromTerm;
  if (!appliedAt) return null;
  return cycleForDate(new Date(appliedAt));
}

export function currentCycle(): number {
  return cycleForDate(new Date());
}

export function cycleLabel(year: number): string {
  return `Fall ${year} – Summer ${year + 1}`;
}

export function cycleShortLabel(year: number): string {
  return `${year}-${year + 1}`;
}

// Parses the `?cycle=` search param used by the dashboard Statistics panel
// and the applications page. undefined return value means "all cycles, no
// filtering"; the param is absent (not "all") by default so a fresh visit
// defaults to the current cycle instead, per the issue's request.
export function parseCycleSearchParam(raw: string | undefined): number[] | undefined {
  if (!raw) return [currentCycle()];
  if (raw === "all") return undefined;
  const years = raw
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => !Number.isNaN(n));
  return years.length > 0 ? years : [currentCycle()];
}

// Serializes a selection back into the `?cycle=` param value (the inverse of
// parseCycleSearchParam), newest cycle first.
export function serializeCycleSearchParam(cycles: number[] | undefined): string {
  if (!cycles || cycles.length === 0) return "all";
  return Array.from(new Set(cycles))
    .sort((a, b) => b - a)
    .join(",");
}
