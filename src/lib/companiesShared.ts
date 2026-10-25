// Pure logic shared between server code (src/lib/companies.ts) and client
// components (ApplicationForm, ContactForm). No runtime import of
// @/lib/prisma — see CLAUDE.md's "Client-safe shared modules" pattern.

/** Lowercase, trim, and strip trailing punctuation so near-identical names compare equal. */
function normalizeCompanyName(name: string): string {
  return name.trim().toLowerCase().replace(/[.,]+$/, "");
}

/** Plain Levenshtein edit distance — no dependency, fine for the short strings company names are. */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prevDiag = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = row[j];
      row[j] = a[i - 1] === b[j - 1] ? prevDiag : 1 + Math.min(prevDiag, row[j], row[j - 1]);
      prevDiag = temp;
    }
  }
  return row[n];
}

/**
 * Soft "did you mean an existing company?" check for the free-text company fields in
 * ApplicationForm/ContactForm. Pure/synchronous (no Prisma) so client components can call it
 * directly against the `companies` prop they already have, without a round-trip.
 *
 * A true case-insensitive duplicate (what findOrCreateCompanyForUser already reuses silently)
 * is intentionally excluded here — this is only for near-misses the user probably didn't intend
 * to create as a separate company ("Acme Corp." vs "Acme Corp", "acme" vs "Acme Corp").
 */
export function findNearDuplicateCompanyName(typed: string, existingNames: string[]): string | null {
  const normalizedTyped = normalizeCompanyName(typed);
  if (normalizedTyped.length < 2) return null;

  for (const existing of existingNames) {
    const normalizedExisting = normalizeCompanyName(existing);
    if (!normalizedExisting || normalizedExisting === normalizedTyped) continue;

    const isSubstringMatch =
      normalizedExisting.includes(normalizedTyped) || normalizedTyped.includes(normalizedExisting);

    const maxLen = Math.max(normalizedTyped.length, normalizedExisting.length);
    const isCloseEdit = maxLen <= 8 && levenshteinDistance(normalizedTyped, normalizedExisting) <= 2;

    if (isSubstringMatch || isCloseEdit) {
      return existing;
    }
  }

  return null;
}
