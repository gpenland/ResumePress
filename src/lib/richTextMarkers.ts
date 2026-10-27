// The "non-whitespace-padded" content a `*`/`**` emphasis marker requires on
// both sides to open or close — CommonMark's flanking-delimiter rule,
// simplified for this app's bold/italic-only subset. Shared between
// src/templates/jake.ts (PDF output) and EntryForm.tsx (live preview) so a
// literal, unrelated `*` in a bullet (e.g. "A* pathfinding", "O(n*log n)")
// can't get greedily paired with another and silently eaten by either side —
// and so the two can't drift apart and disagree with each other about what a
// bullet renders as. See IMPROVEMENTS.md #3.
export const EMPHASIS_CONTENT_SOURCE = String.raw`\S(?:[^*]*\S)?`;

// The exact two regexes jake.ts's applyFormatting() replaces with, in order
// (bold pass first, then italic) — exported so EntryForm.tsx's preview
// parser below runs the identical matching, not just a copy built from the
// same content-pattern fragment. jake.ts imports these directly rather than
// constructing its own copies, so there's only ever one definition to go
// out of sync.
export const BOLD_RE = new RegExp(String.raw`\*\*(${EMPHASIS_CONTENT_SOURCE})\*\*`, "g");
export const ITALIC_RE = new RegExp(String.raw`\*(${EMPHASIS_CONTENT_SOURCE})\*`, "g");

export type RichTextNode = { kind: "text"; value: string } | { kind: "bold" | "italic"; children: RichTextNode[] };

// Reserved Unicode Private Use Area code points — can't appear in ordinary
// bullet text, and (like jake.ts's own "\textbf{"/"\textit{" output) aren't
// `*` or whitespace, so inserting them doesn't shift where the second
// (italic) pass below finds its own matches relative to what jake.ts finds
// in its LaTeX string. BOLD_OPEN/ITALIC_OPEN get a single shared CLOSE
// marker — not a matched pair each — because that's what actually mirrors
// jake.ts: it emits a bold/italic span as "\textbf{" or "\textit{" followed
// by a plain "}", and LaTeX brace-matching is a single stack of generic
// "}"s, not named open/close pairs. A marker whose content itself contains
// an unpaired boundary `*` (e.g. "**a***b*") makes jake.ts's two sequential
// whole-string replaces produce a bold span whose content absorbs the next
// "*" and whose closing brace ends up swallowed by a *second*, separately-
// matched italic span — which only renders sensibly as nested, generically-
// closed spans, not as cleanly-nested named tags. Mirroring that exactly
// (down to the same edge-case weirdness) is the point: this function's job
// is parity with the PDF, not a "better" parse of adversarial input.
const BOLD_OPEN = "";
const ITALIC_OPEN = "";
const CLOSE = "";

/**
 * Parses `**bold**`/`*italic*` markers into a tree for rendering (e.g. to
 * JSX) by running jake.ts's exact two-pass algorithm — BOLD_RE.replace then
 * ITALIC_RE.replace, over the whole string, in that order — but replacing
 * with reserved sentinel characters instead of LaTeX commands, then parsing
 * the sentinel-marked string with a brace-matching stack (see CLOSE above).
 * Guarantees this always resolves a bullet exactly the way jake.ts's PDF
 * output does, including jake.ts's own edge-case behavior for adversarial
 * input — see IMPROVEMENTS.md #3 and the audit that found the two had
 * drifen apart despite sharing EMPHASIS_CONTENT_SOURCE.
 */
export function parseRichText(text: string): RichTextNode[] {
  const marked = text
    .replace(BOLD_RE, (_match, content: string) => BOLD_OPEN + content + CLOSE)
    .replace(ITALIC_RE, (_match, content: string) => ITALIC_OPEN + content + CLOSE);

  const root: RichTextNode[] = [];
  const stack: RichTextNode[][] = [root];
  let buffer = "";

  function flush() {
    if (buffer) {
      stack[stack.length - 1].push({ kind: "text", value: buffer });
      buffer = "";
    }
  }

  for (const ch of marked) {
    if (ch === BOLD_OPEN || ch === ITALIC_OPEN) {
      flush();
      const node: RichTextNode = { kind: ch === BOLD_OPEN ? "bold" : "italic", children: [] };
      stack[stack.length - 1].push(node);
      stack.push(node.children);
    } else if (ch === CLOSE) {
      flush();
      // Always balanced by construction (every OPEN this loop sees came
      // from a regex match that also inserted exactly one CLOSE), so the
      // root level is never popped — this check is just defensive.
      if (stack.length > 1) stack.pop();
    } else {
      buffer += ch;
    }
  }
  flush();

  return root;
}
