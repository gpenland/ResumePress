// Pure constants/types/logic shared between server code (src/lib/emailThreads.ts)
// and client components (ApplicationPicker). Deliberately has no runtime import
// of @/lib/prisma — only type-only shapes — so client components can import
// from here without bundling the Prisma client. See CLAUDE.md's "Client-safe
// shared modules" pattern.

export type ApplicationPickerOption = {
  id: string;
  roleTitle: string;
  companyName: string;
  companyDomain: string | null;
  status: string;
  updatedAt: Date;
};

// Statuses that are unlikely to be the right match for a *new* incoming email
// unless something else (a domain match) says otherwise — used only as a
// tie-breaker, never to hide an option outright.
const STALE_STATUSES = new Set(["Rejected", "Ghosted"]);

export function extractDomain(url: string): string | null {
  try {
    const withProtocol = url.startsWith("http") ? url : `https://${url}`;
    return new URL(withProtocol).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function participantDomains(participants: string[]): Set<string> {
  return new Set(
    participants
      .map((p) => p.split("@")[1]?.toLowerCase())
      .filter((d): d is string => Boolean(d))
  );
}

export function isDomainMatch(option: ApplicationPickerOption, participants: string[]): boolean {
  if (!option.companyDomain) return false;
  return participantDomains(participants).has(option.companyDomain);
}

/**
 * Orders applications so the most plausible match for a given email thread
 * sorts first: a company-domain match beats everything else, then
 * non-stale statuses beat stale ones, then most-recently-updated wins. This
 * is what makes a flat list of every application tractable in the triage
 * picker — the right answer is usually already near the top.
 */
export function rankApplicationOptions(
  options: ApplicationPickerOption[],
  participants: string[]
): ApplicationPickerOption[] {
  return [...options].sort((a, b) => {
    const aMatch = isDomainMatch(a, participants) ? 1 : 0;
    const bMatch = isDomainMatch(b, participants) ? 1 : 0;
    if (aMatch !== bMatch) return bMatch - aMatch;

    const aStale = STALE_STATUSES.has(a.status) ? 1 : 0;
    const bStale = STALE_STATUSES.has(b.status) ? 1 : 0;
    if (aStale !== bStale) return aStale - bStale;

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function matchesApplicationSearch(option: ApplicationPickerOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    option.companyName.toLowerCase().includes(q) ||
    option.roleTitle.toLowerCase().includes(q)
  );
}

export function applicationOptionLabel(option: ApplicationPickerOption): string {
  return `${option.companyName} — ${option.roleTitle}`;
}
