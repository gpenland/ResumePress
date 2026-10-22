// Pure constants/types/functions shared between server code (src/lib/applications.ts)
// and client components (StatusSelect, ApplicationsList, ApplicationsKanban,
// ImportCsvDialog). Deliberately has no runtime import of @/lib/prisma — only
// type-only imports from @prisma/client, which are erased at compile time —
// so client components can import from here without bundling the Prisma client.

import type { Application, Company } from "@prisma/client";

// Suggested statuses from PLAN.md §3. Stored as a free-form string column (not
// an enum), so this list is a UI affordance, not a DB constraint — importers
// and future custom statuses aren't blocked by it.
export const APPLICATION_STATUSES = [
  "Wishlist",
  "Preparing",
  "Applied",
  "OA/Screen",
  "Interviewing",
  "Offer",
  "Accepted",
  "Rejected",
  "Withdrawn",
  "Ghosted",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type ApplicationWithCompany = Application & { company: Company };

// --- CSV import/export -----------------------------------------------------
// Plain-text round trip of the fields a user is likely to want to bulk-edit or
// migrate from a spreadsheet. Deliberately not the Notion importer from
// PLAN.md §6 Phase 3 (that needs its own column-mapping step); this is a
// generic export/re-import of this app's own Application fields.

export const APPLICATION_CSV_COLUMNS = [
  "company",
  "roleTitle",
  "term",
  "status",
  "appliedAt",
  "deadline",
  "postingUrl",
  "location",
  "source",
  "priority",
  "nextFollowUpAt",
  "notes",
] as const;

export type ApplicationCsvColumn = (typeof APPLICATION_CSV_COLUMNS)[number];
export type ApplicationCsvRow = Record<ApplicationCsvColumn, string>;

function csvField(value: string | null | undefined): string {
  const v = value ?? "";
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function isoDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function applicationsToCsv(applications: ApplicationWithCompany[]): string {
  const header = APPLICATION_CSV_COLUMNS.join(",");
  const lines = applications.map((app) =>
    [
      csvField(app.company.name),
      csvField(app.roleTitle),
      csvField(app.term),
      csvField(app.status),
      csvField(isoDate(app.appliedAt)),
      csvField(isoDate(app.deadline)),
      csvField(app.postingUrl),
      csvField(app.location),
      csvField(app.source),
      csvField(app.priority),
      csvField(isoDate(app.nextFollowUpAt)),
      csvField(app.notes),
    ].join(",")
  );
  return [header, ...lines].join("\n") + "\n";
}

/** Minimal RFC4180-ish line splitter: handles quoted fields with embedded commas/quotes. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

export type ParsedApplicationsCsv = {
  rows: ApplicationCsvRow[];
  errors: string[];
};

/**
 * Parses CSV text into rows. Pure/sync and dependency-free so the same
 * function drives both the client-side dry-run preview and the server
 * action that commits the import.
 */
export function parseApplicationsCsv(text: string): ParsedApplicationsCsv {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], errors: ["CSV is empty."] };

  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const errors: string[] = [];
  const missing = APPLICATION_CSV_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    errors.push(`Missing column(s): ${missing.join(", ")}`);
    return { rows: [], errors };
  }

  const rows: ApplicationCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const row = {} as ApplicationCsvRow;
    header.forEach((col, idx) => {
      if ((APPLICATION_CSV_COLUMNS as readonly string[]).includes(col)) {
        row[col as ApplicationCsvColumn] = (values[idx] ?? "").trim();
      }
    });
    if (!row.company || !row.roleTitle) {
      errors.push(`Row ${i + 1}: missing required "company" or "roleTitle".`);
      continue;
    }
    rows.push(row);
  }

  return { rows, errors };
}
