// Turning third-party HTML into plain text, with no HTML parser dependency —
// shared by jobPosting.ts (job posting pages) and gmail.ts (HTML email
// bodies, fetched transiently for Jev classification, never persisted).

export function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

// Drops <script>/<style> blocks wholesale (their text content is noise, not
// readable content) before stripping the remaining tags and collapsing
// whitespace. Callers decode entities themselves if they need to (several
// call sites extract a value, then decode, then strip — order matters for
// them), except where noted.
export function stripTags(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
