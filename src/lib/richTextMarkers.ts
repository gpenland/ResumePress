// The "non-whitespace-padded" content a `*`/`**` emphasis marker requires on
// both sides to open or close — CommonMark's flanking-delimiter rule,
// simplified for this app's bold/italic-only subset. Shared between
// src/templates/jake.ts (PDF output) and EntryForm.tsx (live preview) so a
// literal, unrelated `*` in a bullet (e.g. "A* pathfinding", "O(n*log n)")
// can't get greedily paired with another and silently eaten by either side —
// and so the two can't drift apart and disagree with each other about what a
// bullet renders as. See IMPROVEMENTS.md #3.
export const EMPHASIS_CONTENT_SOURCE = String.raw`\S(?:[^*]*\S)?`;
