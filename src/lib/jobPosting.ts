// Extracts company/role/location/term from a job-posting URL for the
// "Autofill from link" button on the new-Application form. Deterministic
// extraction first (schema.org JobPosting JSON-LD, which most job boards
// embed); Jev's Choice primitive is only used to disambiguate between a
// handful of regex-found candidates when JSON-LD doesn't resolve a field —
// never to invent a value. See src/lib/jev.ts and feedback_jev_actionability.

import { fetchExternalUrl } from "@/lib/urlFetch";
import { askJev, type JevQuestion } from "@/lib/jev";
import { decodeHtmlEntities, stripTags } from "@/lib/htmlText";

export type JobPostingAutofill = {
  companyName: string | null;
  roleTitle: string | null;
  location: string | null;
  term: string | null;
};

type JsonLdLocation = { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } };
type JsonLdJobPosting = {
  title?: unknown;
  description?: unknown;
  hiringOrganization?: { name?: unknown } | { name?: unknown }[];
  jobLocation?: JsonLdLocation | JsonLdLocation[];
};

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeHtmlEntities(stripTags(m[1])) : null;
}

function extractFirstH1(html: string): string | null {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? decodeHtmlEntities(stripTags(m[1])) : null;
}

function extractMetaContent(html: string, propertyOrName: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const propMatch = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i);
    if (!propMatch || propMatch[1].toLowerCase() !== propertyOrName) continue;
    const contentMatch = tag.match(/content\s*=\s*["']([^"']*)["']/i);
    if (contentMatch) return decodeHtmlEntities(contentMatch[1].trim());
  }
  return null;
}

function searchForJobPosting(node: unknown): JsonLdJobPosting | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = searchForJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const type = obj["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) {
      return obj as JsonLdJobPosting;
    }
    if (obj["@graph"]) return searchForJobPosting(obj["@graph"]);
  }
  return null;
}

function findJobPostingJsonLd(html: string): JsonLdJobPosting | null {
  const scriptRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html))) {
    try {
      const found = searchForJobPosting(JSON.parse(match[1].trim()));
      if (found) return found;
    } catch {
      continue;
    }
  }
  return null;
}

function companyNameFromJsonLd(org: JsonLdJobPosting["hiringOrganization"]): string | null {
  const first = Array.isArray(org) ? org[0] : org;
  return typeof first?.name === "string" ? decodeHtmlEntities(first.name.trim()) : null;
}

function formatLocation(jobLocation: JsonLdJobPosting["jobLocation"]): string | null {
  if (!jobLocation) return null;
  const locations = Array.isArray(jobLocation) ? jobLocation : [jobLocation];
  const formatted = locations
    .map((loc) => {
      const addr = loc?.address;
      if (!addr) return null;
      const cityState = [addr.addressLocality, addr.addressRegion].filter(Boolean).join(", ");
      return cityState || addr.addressCountry || null;
    })
    .filter((s): s is string => Boolean(s));
  const unique = dedupe(formatted);
  return unique.length > 0 ? unique.join("; ") : null;
}

const TERM_RE = /\b(Spring|Summer|Fall|Winter)\s+20\d{2}\b/gi;

function findTermCandidates(text: string): string[] {
  return dedupe(text.match(TERM_RE) ?? []);
}

export async function extractJobPostingFromUrl(
  url: string
): Promise<{ ok: true; data: JobPostingAutofill } | { ok: false; error: string }> {
  const fetched = await fetchExternalUrl(url);
  if (!fetched.ok) return { ok: false, error: fetched.error };
  const { html } = fetched;

  const jobPosting = findJobPostingJsonLd(html);
  const description = typeof jobPosting?.description === "string" ? stripTags(jobPosting.description) : null;

  const pageTitle = extractTitle(html);
  const ogTitle = extractMetaContent(html, "og:title");
  const ogSiteName = extractMetaContent(html, "og:site_name");
  const h1 = extractFirstH1(html);

  let companyName = companyNameFromJsonLd(jobPosting?.hiringOrganization) ?? ogSiteName;

  let roleTitle = typeof jobPosting?.title === "string" ? decodeHtmlEntities(jobPosting.title.trim()) : null;
  const roleCandidates = dedupe([pageTitle, ogTitle, h1].filter((s): s is string => Boolean(s)));
  if (!roleTitle && roleCandidates.length === 1) roleTitle = roleCandidates[0];

  const location = formatLocation(jobPosting?.jobLocation);

  const termCandidates = findTermCandidates([pageTitle, ogTitle, description].filter(Boolean).join(" "));
  let term: string | null = termCandidates.length === 1 ? termCandidates[0] : null;

  const questions: Record<string, JevQuestion> = {};
  if (!roleTitle && roleCandidates.length >= 2) {
    questions.role = {
      type: "choice",
      instructions:
        "Which of these is most likely the actual job title/role for this posting, as opposed to a generic page heading, company name, or marketing tagline?",
      criteria: Object.fromEntries(roleCandidates.map((c) => [c, c])),
    };
  }
  if (!term && termCandidates.length >= 2) {
    questions.term = {
      type: "choice",
      instructions:
        "Which season/year is this specific job posting's own term, as opposed to an unrelated date mentioned elsewhere on the page?",
      criteria: Object.fromEntries(termCandidates.map((c) => [c, c])),
    };
  }

  if (Object.keys(questions).length > 0) {
    const state = [pageTitle, ogTitle, h1, description].filter(Boolean).join("\n");
    const result = await askJev(state, questions);
    if (result.ok) {
      const roleAnswer = result.answers.role;
      if (roleAnswer?.type === "choice" && roleCandidates.includes(roleAnswer.choice)) {
        roleTitle = roleAnswer.choice;
      }
      const termAnswer = result.answers.term;
      if (termAnswer?.type === "choice" && termCandidates.includes(termAnswer.choice)) {
        term = termAnswer.choice;
      }
    }
    // A failed Jev call just leaves the ambiguous field(s) unresolved rather
    // than failing the whole autofill — JSON-LD-derived fields are still useful.
  }

  if (!companyName && !roleTitle && !location && !term) {
    return { ok: false, error: "Could not find job posting details on that page." };
  }

  return { ok: true, data: { companyName, roleTitle, location, term } };
}
