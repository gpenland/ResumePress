// Pure, dependency-free CSV parsing shared across every CSV feature in the
// app (Applications export/import, the Notion importer). No Prisma import —
// safe for client components.

/** Minimal RFC4180-ish line splitter: handles quoted fields with embedded commas/quotes. */
export function splitCsvLine(line: string): string[] {
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

// A leading '=', '+', '-', or '@' sign is a well-known CSV/formula-injection
// vector: Excel/Sheets execute the cell as a formula on open. Prefixing with a
// single quote defuses it while keeping the value visible — the standard
// mitigation (flagged by the Phase 4 audit).
const FORMULA_PREFIX = /^[=+\-@]/;

export function csvField(value: string | null | undefined): string {
  let v = value ?? "";
  if (FORMULA_PREFIX.test(v)) v = `'${v}`;
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export type CsvTable = { headers: string[]; rows: string[][] };

/** Splits raw CSV text into a header row and data rows, with no assumptions about column names — used by the Notion importer's column-mapping step, which can't assume a fixed format. */
export function parseCsvTable(text: string): CsvTable {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map(splitCsvLine);
  return { headers, rows };
}
