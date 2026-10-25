// Pure column-mapping logic for the Notion CSV importer (PLAN.md §6 Phase 3).
// A Notion export's columns are arbitrary and won't match any fixed format,
// so this is a mapping step, not a fixed parser. No Prisma import — safe for
// client components.

export { parseCsvTable } from "@/lib/csv";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/applicationsShared";

export const APPLICATION_IMPORT_FIELDS = [
  { key: "companyName", label: "Company", required: true },
  { key: "roleTitle", label: "Role", required: true },
  { key: "term", label: "Term", required: false },
  { key: "status", label: "Status", required: false },
  { key: "appliedAt", label: "Applied date", required: false },
  { key: "postingUrl", label: "Posting URL", required: false },
  { key: "location", label: "Location", required: false },
  { key: "source", label: "Source", required: false },
  { key: "notes", label: "Notes", required: false },
  { key: "externalId", label: "External / row ID (enables safe re-import)", required: false },
] as const;

export type ImportFieldKey = (typeof APPLICATION_IMPORT_FIELDS)[number]["key"];

/** Maps a target field key to the index of the CSV column the user picked for it, or undefined if left unmapped. */
export type ColumnMapping = Partial<Record<ImportFieldKey, number>>;

export type MappedApplicationRow = {
  companyName: string;
  roleTitle: string;
  term: string | null;
  status: string | null;
  appliedAt: string | null;
  postingUrl: string | null;
  location: string | null;
  source: string | null;
  notes: string | null;
  externalId: string | null;
};

/** Best-effort auto-mapping by matching a CSV header to a field's key or label (case/punctuation-insensitive). Always a starting point for the user to correct, never applied silently. */
export function guessColumnMapping(headers: string[]): ColumnMapping {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedHeaders = headers.map(normalize);

  const mapping: ColumnMapping = {};
  for (const field of APPLICATION_IMPORT_FIELDS) {
    const candidates = [normalize(field.key), normalize(field.label)];
    const idx = normalizedHeaders.findIndex((h) => candidates.some((c) => h.includes(c) || c.includes(h)));
    if (idx !== -1) mapping[field.key] = idx;
  }
  return mapping;
}

export type MappingResult = { rows: MappedApplicationRow[]; errors: string[] };

export function applyColumnMapping(rows: string[][], mapping: ColumnMapping): MappingResult {
  function get(row: string[], field: ImportFieldKey): string | null {
    const idx = mapping[field];
    if (idx === undefined) return null;
    const value = row[idx]?.trim();
    return value || null;
  }

  const mapped: MappedApplicationRow[] = [];
  const errors: string[] = [];

  rows.forEach((row, i) => {
    const companyName = get(row, "companyName");
    const roleTitle = get(row, "roleTitle");
    if (!companyName || !roleTitle) {
      errors.push(`Row ${i + 2}: missing required Company or Role.`); // +2: header is row 1
      return;
    }
    mapped.push({
      companyName,
      roleTitle,
      term: get(row, "term"),
      status: get(row, "status"),
      appliedAt: get(row, "appliedAt"),
      postingUrl: get(row, "postingUrl"),
      location: get(row, "location"),
      source: get(row, "source"),
      notes: get(row, "notes"),
      externalId: get(row, "externalId"),
    });
  });

  return { rows: mapped, errors };
}

/**
 * Notion's status property exports its full option history as a comma-separated
 * list (e.g. "Applied, Rejected") rather than just the current value. Splits that
 * into the ordered list of recognized statuses, oldest first, so the importer can
 * both set the *current* status to the last entry and seed ApplicationStatusHistory
 * with the transitions in between, instead of silently keeping the default "Applied".
 * Unrecognized entries (free-form notes Notion users sometimes mix in) are dropped.
 */
export function parseStatusHistory(raw: string | null): ApplicationStatus[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ApplicationStatus => (APPLICATION_STATUSES as readonly string[]).includes(s));
}
