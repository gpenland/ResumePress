# Improvements

Ranked audit of ResumePress for bugs, dead code, slow paths, and missing
functionality (2026-10-26). Dead-code pass came back clean — no actionable
items; it's folded into the notes below instead of taking its own slots.
Ranked by impact against the product's goals: a high-quality, enjoyable,
efficient experience; useful functionality without overload; elegant,
simple, consistent design; simple data in, simple data out.

## 1. SSRF guard has a DNS-rebinding (TOCTOU) bypass

**File:** `src/lib/urlFetch.ts` (`assertPublicHost`, ~lines 39–82)

`assertPublicHost()` resolves the hostname via `dns.lookup()` and checks the
result isn't private/loopback/link-local, then a *separate* `fetch()` call
lets Node re-resolve the same hostname independently to actually connect. A
DNS answer that changes between those two lookups (attacker-controlled DNS,
TTL=0, round-robin between a public decoy and `169.254.169.254` or an
internal IP) passes the check with a public address while the real
connection goes to a private one. This is the one fetch path in the app that
hits attacker-influenceable URLs ("Autofill from link"), and the file's own
header comment already calls out that it's security-sensitive — the guard
just doesn't close the actual race.

**Fix shape:** resolve once, validate, then force the connection to use that
exact validated IP (e.g. a custom `lookup` on the `http(s)` agent / undici
dispatcher that returns the pinned address), instead of trusting a second,
independent resolution.

## 2. PDF compile/open failures render as raw JSON with no way back

**Files:** `src/components/ResumeBuilder.tsx` (~line 115, `window.location.href`
download), `src/components/applications/ResumeSection.tsx` (~line 62, plain
`<a href>`), `src/app/api/pdf/[resumeId]/route.ts`

The route's server-side error handling is fine (a proper 500 with
`{error, detail}`), but both "Download PDF" and "Open" navigate the whole
page/tab directly to that API route. A failed compile — malformed LaTeX
input, a pdflatex timeout, an unescaped edge case — replaces the entire page
with unstyled JSON and no in-app way back except the browser Back button.
This is the single most core feature in the app (a resume builder that
can't gracefully report "that didn't compile" is not high-quality), and
PDF-rendering bugs have already hit production twice before (see git
history / prior copy-paste encoding fixes), so this isn't hypothetical.

**Fix shape:** fetch the PDF from a client component instead of a bare
navigation, show a normal in-app error state (toast/inline message) on
non-200, and only hand the user a blob URL (new tab or `<iframe>`) on
success.

## 3. Bold/italic markdown in bullets silently mangles text with a literal `*`

**File:** `src/templates/jake.ts` (`applyFormatting`, ~lines 55–61)

The italic regex `/\*([^*]+)\*/g` has no escape for a single literal `*`.
A bullet like `"Built A* pathfinding engine; tuned O(n*log n) runtime"` has
two unrelated single asterisks; the regex greedily italicizes everything
between them and silently drops both `*` characters from the compiled PDF.
This directly breaks the documented `**bold**`/`*italic*` bullet syntax
(CLAUDE.md "Rich text in bullets") for any technical bullet that happens to
contain a bare asterisk — exactly the "what you type is what prints"
guarantee a resume tool needs to hold.

**Fix shape:** require paired single `*` with no immediately-adjacent `*`
(to not re-catch `**bold**`), or adopt an unambiguous escape (`\*`) for a
literal asterisk, documented alongside the existing bold/italic markers.

## 4. Gmail sync is fully sequential — slow and a timeout risk

**File:** `src/lib/emailThreads.ts` (`syncGmailForUser`, ~lines 279–310)

The sync loop does one Gmail API call + one `findUnique` + one `upsert` per
thread, one at a time, with zero concurrency. On a first sync or a busy
label with dozens of new threads, that's N serial network round-trips plus
2N DB calls — easily tens of seconds to minutes, risking a platform request
timeout (Sevalla) before the sync finishes, on the module CLAUDE.md already
flags as "the least-proven" in the codebase.

**Fix shape:** batch thread fetches with bounded concurrency (e.g.
`Promise.all` over chunks of 5–10), keeping the existing idempotent
upsert/match logic as-is.

## 5. AI-assisted features can fail silently with no user-visible explanation

**Files:** `src/lib/jobPosting.ts`, `src/lib/urlFetch.ts`, `src/lib/jev.ts`
(bare `catch {}` blocks)

Not fully traced to a concrete repro, but each of these has at least one
catch block that doesn't clearly propagate a message for every failure
mode. If "Autofill from link" or a Jev suggestion does nothing on a fetch
failure that isn't one of the explicitly-handled cases, the user has no way
to tell "it found nothing" from "it broke" — which quietly erodes trust in
every AI-assisted feature in the app, not just the one that happened to
fail.

**Fix shape:** audit each catch site; every one should either surface a
specific `{ok:false, error}` the caller already renders, or be narrowed to
only swallow the cases it's actually meant to.

## 6. Entry version history is a raw field dump, not a diff

**Files:** `src/lib/entries.ts` (`EntryVersion` write path),
`EntryHistory.tsx`

Each expanded version row shows the *entire* field set at that point in
time, so spotting what actually changed between two edits means manually
comparing two full dumps by eye. The feature already does the hard part
(snapshotting before a no-op-skipped edit) — this is a presentation gap on
an existing feature, not new scope: highlight just the fields that differ
from the version before them.

## 7. No indexes beyond implicit unique constraints

**File:** `prisma/schema.prisma`

Every query in the app filters by `userId`, and several also filter/sort by
`status`, `matchStatus`, `occurredAt`, or `lastMessageAt` — none of it
indexed (Postgres doesn't auto-index plain FK columns). Harmless at today's
scale; free to fix now, and the alternative is debugging a slow query later
with no signal that this was the cause. Candidates: `Application(userId,
status)`, `Interaction(userId, occurredAt)`, `EmailThread(userId,
matchStatus)`, `EmailThread(userId, lastMessageAt)`.

## 8. Dashboard has no "needs attention" signal for applications

**Files:** `src/app/(protected)/page.tsx`, `src/lib/applications.ts`

The dashboard surfaces the 5 most-recently-updated applications and a
triage count, but nothing flags applications that have gone quiet — no
status change or logged interaction in, say, 14+ days. The app already has
an analogous idea for contacts (`nextFollowUpAt`, currently unused on the
dashboard) but nothing for applications, which are the primary object in
the tracker. This is the one genuinely new (small) feature on this list:
a "needs a follow-up" dashboard card, computed from data that already
exists (`ApplicationStatusHistory`/`updatedAt`) — no new entities, no new
settings surface, just a derived view that serves the app's actual job
(don't let an application silently die from inaction).

## 9. List pages have no pagination ceiling

**Files:** `src/lib/applications.ts`, `contacts.ts`, `entries.ts`,
`resumes.ts` (`listXForUser` functions)

Every list page `findMany`s a user's *entire* table with no `take`/`skip`.
Not a problem at today's row counts, and genuinely not urgent — but it's a
feature addition (cursor or offset pagination + UI), not a config flip, so
it's cheaper to design in now than to retrofit once someone's application
list is in the thousands.

## 10. Reversed UI decisions keep getting re-litigated with no record of why

**Observation, not a single file.** Today's history alone shows the nav
search control centered, then collapsed to an icon, then reverted; an ATS
score feature built, then reverted. Each was a reasonable call in isolation,
but with no durable record of *why* a direction was rejected, there's
nothing stopping the next pass from re-trying the same thing. CLAUDE.md
already does this well for a couple of specific cases (the Jev ATS-score
revert is documented inline); the gap is that it's ad hoc rather than a
habit. A short "Decisions" section (or just consistently landing the
*rationale* in the commit/PR body, as several already do) would keep this
from costing the same thrash twice — directly in service of the "consistent
design" goal, not a process nicety for its own sake.
