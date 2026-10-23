# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ResumePress started as a resume builder and was merged with a job-application tracker (Applications, Contacts, Interactions, Gmail sync — see "Job Application Tracker" below) across `PLAN.md`'s phases 0-4, all now complete. `PLAN.md` (original spec) and `docs/MIGRATION_PLAN.md` (the actual decisions made, with their rationale) are the detailed historical record of *why* things are the way they are; this file documents *what exists now* and should be kept current as the living reference — treat a stale section here as a bug.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npx tsc --noEmit     # Type-check without building

npm run db:migrate   # Run Prisma migrations (requires running Postgres)
npm run db:seed      # Seed built-in categories
npm run db:studio    # Open Prisma Studio

# Add a shadcn component (uses base-ui variant, NOT Radix)
npx shadcn@latest add <component-name>
```

Postgres must be running for `dev` and `db:*` commands. `.env` (see `.env.example`) needs `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/resumepress?schema=public`, plus `AUTH_SECRET` (generate with `npx auth secret`), `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` from a Google Cloud OAuth 2.0 Web application client (authorized redirect URI: `<origin>/api/auth/callback/google`, for both `http://localhost:3000` and the Sevalla production domain), plus `ALLOWED_EMAILS` and `GMAIL_TOKEN_ENCRYPTION_KEY` (see "Auth" below).

## Architecture

**Stack:** Next.js 16 App Router · TypeScript · Tailwind CSS v4 · Prisma 5 + PostgreSQL · shadcn/ui (base-ui variant)

**PDF generation:** `GET /api/pdf/[resumeId]` fetches the resume + selected entries from the DB and groups them by category, then hands off to `compileResumeToPdf` (`src/lib/resumeCompiler.ts`, see "Key Patterns"), which renders via `src/templates/jake.ts`, writes the `.tex` to a temp dir, runs `pdflatex` twice, and returns the PDF buffer for the route to stream back. The same `compileResumeToPdf` is also called by the MCP `compile_resume` tool (see "MCP Server") for DB-free, inline compiles. pdflatex must be installed locally (`brew install --cask mactex-no-gui`) or is included in the Docker image via `apt-get install texlive-*`.

**Deployment:** Docker + Sevalla. `docker-entrypoint.sh` runs `prisma migrate deploy`, seeds categories, then `node server.js`. `next.config.ts` uses `output: "standalone"`.

**Auth:** two independent auth systems, for two different kinds of client.

- **Browser/session auth** — NextAuth.js (Auth.js v5) with Google OAuth only, configured in `src/lib/auth.ts` (database session strategy via `@auth/prisma-adapter`). **App-wide allowlist**: every page under `src/app/(protected)/` (which is every page except `/login` and `/unauthorized`) is gated by `src/app/(protected)/layout.tsx`, which redirects to `/login` with no session, or `/unauthorized` if the session's email isn't in `ALLOWED_EMAILS` (comma-separated — more than one person can use a deployment, each with fully isolated `userId`-scoped data). Route Handlers (`route.ts`) aren't covered by layouts, so each one that needs the gate checks it explicitly — see `GET /api/pdf/[resumeId]`'s use of `getAllowedUserId()`. (This is additive to, not a replacement for, the `userId`-scoped ownership-check pattern below — see docs/MIGRATION_PLAN.md §1.2. It also pairs with, rather than replaces, restricting the Google Cloud OAuth consent screen's own Test users list, which blocks anyone not on it before they ever reach this app.) Helpers from `src/lib/auth.ts`:
  - `getUserId()` — for pages/reads. Returns the session's user id or `null`; never redirects. Now effectively always non-null on a gated page (the layout guarantees a session), but still null-checked defensively — kept as a fail-safe, not removed, when the gate was added.
  - `requireUserId()` — for server actions that write data. Redirects to `/login` if there's no session.
  - `isAllowedEmail(email)` — the allowlist check itself (membership in `ALLOWED_EMAILS`, case-insensitive).
  - `getAllowedUserId()` — for Route Handlers only; returns the caller's `userId` or `null` (no session, or not on the allowlist).
- **Agent/API-key auth** — a separate bearer-token mechanism in `src/lib/apiToken.ts`, purpose-built for non-browser clients (the MCP server below). `generateApiToken()` mints a `rp_`-prefixed random token and stores only its SHA-256 hash; `getUserIdFromBearerToken(req)` reads the `Authorization: Bearer <token>` header, hashes it, looks up the `ApiToken` row, checks `revokedAt`/`expiresAt`, bumps `lastUsedAt`, and returns the associated `userId` (or `null`). Users create/revoke tokens at `/settings/tokens` (session-authenticated page, uses `requireUserId()`). This system never touches NextAuth sessions or cookies, and is **not** covered by the allowlist gate above — it's a separate authorization boundary, scoped per-token rather than per-session, and `/api/mcp` must stay reachable without a browser session for the Claude connector to work.
- **Gmail connection** (optional, independent of login) — `src/lib/encryption.ts` (AES-256-GCM, keyed by `GMAIL_TOKEN_ENCRYPTION_KEY`, separate from `AUTH_SECRET`) and `src/lib/gmailAccount.ts` back a `GmailAccount` row per user. `/api/gmail/oauth/{start,callback}` run their own OAuth handshake against the *same* `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` client (just a second authorized redirect URI + the `gmail.readonly` scope) — deliberately not through NextAuth's `signIn()`/`Account`, so re-consenting for Gmail never fights the adapter's own token-write path. Managed at `/settings/gmail`. See docs/MIGRATION_PLAN.md §1.1 for why this is a separate table/flow instead of reusing `Account`. The actual sync/matching logic built on top of this connection is covered in "Job Application Tracker" below, not here — this section is just the OAuth/token-storage half.

## MCP Server

`src/app/api/mcp/route.ts` exposes ResumePress over the Model Context Protocol (`@modelcontextprotocol/sdk`) so agents (e.g. a Claude.ai custom connector) can work with a user's resume data via a bearer token instead of a browser session. The `POST` handler authenticates via `getUserIdFromBearerToken`, builds a per-request `McpServer`, and calls `registerResumePressTools(server, userId)` (`src/lib/mcpTools.ts`) before handing the request to the SDK's streamable-HTTP transport.

Tools registered, all scoped to the authenticated `userId`:
- `list_categories`, `list_entries`, `get_entry`, `list_resumes`, `get_resume` — read-only, delegate to `src/lib/categories.ts` / `entries.ts` / `resumes.ts`.
- `create_entry`, `create_resume` — persist new rows via the same lib functions the server actions use.
- `compile_resume` — the one tool that **never touches Prisma**. It takes identity + entries fully inline (no DB ids) and templateId, compiles a PDF via `compileResumeToPdf` (`src/lib/resumeCompiler.ts`), and returns the PDF as a base64 `resource`/`blob` content block in the same response. Nothing about the request or the compiled PDF is persisted — it's a stateless "compile and discard" path so an agent can iterate on resume content without ever creating real `Entry`/`Resume` rows. Its input is validated against `compileResumeSchema` (`src/lib/schemas/resumeEntry.ts`), which caps section/entry/bullet counts and string lengths since this path bypasses every guard the entry-form UI normally provides; an unrecognized `templateId` is a hard validation error here (unlike the DB-backed PDF route, which silently falls back to `jake`).

Tool input schemas are defined with zod directly in `mcpTools.ts` (mostly ad hoc per tool); `compile_resume`'s schema lives separately in `src/lib/schemas/resumeEntry.ts`. `create_entry`/`create_resume` reuse `entryCoreFieldsSchema`/`identitySchema` from the same file for their own length caps (added in the Phase 4 audit — see "Job Application Tracker" below).

## Job Application Tracker

A companies/applications/contacts/interactions/Gmail-sync tracker merged into this app across `PLAN.md`'s phases 0-4 (all complete). Every table below is additive to the original resume-builder schema and follows the same `userId`-scoped ownership-check pattern (see "Key Patterns").

**Applications** (`src/lib/applications.ts` + `applicationsShared.ts`, `src/app/(protected)/applications/**`) — a list/kanban CRUD for `Application`, grouped under a `Company` (found-or-created by free-text name via `findOrCreateCompanyForUser` in `src/lib/companies.ts`). Every status change writes an `ApplicationStatusHistory` row in the same transaction; `APPLICATION_STATUSES` (`applicationsShared.ts`) is a 6-value suggested list (Applied/OA/Interviewing/Offer/Rejected/Ghosted, default "Applied") — a UI affordance, not a DB constraint, trimmed from a longer original list per GitHub issue #17. History entries can also carry a freeform `note` (editable after the fact, or added via a note-only "log update" with no status change) instead of inventing more statuses. The kanban board (`ApplicationsKanban.tsx`) hides empty status columns except while a card is being dragged, and also offers a per-card `<select>` as a keyboard-operable alternative to drag-and-drop. `ResumeSection` on the detail page is a resume picker (attach/open/recompile-PDF/change/remove) backed by its own `resumeActions.ts`, kept separate from this module's own `actions.ts` by original design (two independently-built pieces touching the same file). A column-mapping CSV importer lives at `/applications/import` (`src/lib/csv.ts` + `src/lib/notionImportShared.ts`) for migrating from an external tracker (e.g. Notion) whose export columns won't match any fixed format — mapping a column to `Application.externalId` makes re-imports idempotent. (An earlier fixed-format CSV export/import pair existed and was removed as dead code once issue #17 unwired it from the UI with no replacement home ever built — don't resurrect that shape; the column-mapping importer is the one to extend if more import sources are needed.)

**Contacts & Interactions** (`src/lib/contacts.ts` + `interactions.ts` + `interactionsShared.ts`, `src/app/(protected)/contacts/**`) — contacts exist independently of any application (`Application`/`Contact` are linked many-to-many via `ApplicationContact`, which carries a free-form `role`). `Interaction.contactId`/`applicationId` are both nullable and independent — an interaction can belong to either, both, or (if its contact/application is later deleted — `onDelete: SetNull`) neither. Both the application and contact detail pages render the same `InteractionTimeline`/`LogInteractionForm`/`ApplicationLinks`-or-`ContactLinks` components from whichever side's module they conceptually belong to (contacts); don't duplicate them per-side. A global "Log interaction" quick-add (`GlobalQuickAdd.tsx`, floating button + the `i` keyboard shortcut) is mounted in `src/app/(protected)/layout.tsx` — deliberately the protected layout and not the root layout, so it only renders for an authenticated, allowlisted session and never shows on `/login`.

**Gmail sync** (`src/lib/gmail.ts` + `emailThreads.ts`, `/settings/gmail`, `/triage`) — read-only (`gmail.readonly` only; grep `src/lib/gmail.ts` for any write/send/modify call before ever adding one — there should be none). Uses plain `fetch` against the Gmail REST API, not the `googleapis` package, matching the OAuth routes' own style. "Sync now" uses the History API when a baseline `historyId` exists, falling back to a capped per-label list on the first sync or an expired history window. **Matching is two-tiered by design**: an exact participant-email-to-contact match auto-links (`matchStatus: "auto"`); a company-domain-to-application guess is only ever a *suggestion*, never auto-linked — anything not exactly contact-matched lands in `/triage` (`matchStatus: "unmatched"`) for manual confirm/reassign/ignore. Every sync also re-runs matching against all currently-`"unmatched"` threads using already-stored data (no Gmail call) — without this, a contact added after a thread's first sync would never retroactively match, since the History API only surfaces threads with *new* activity. Deleting a Gmail-sourced `Interaction` (one with an `emailThreadId`) also sets its `EmailThread` to `matchStatus: "ignored"` rather than leaving a dangling `"auto"` match with no visible trace; `/triage` has a collapsible ignored-threads list with a Restore action as the undo path. A confirmed/auto match mirrors itself onto the matched contact's/application's interaction timeline (idempotent across resyncs — checks for an existing `Interaction` with that `emailThreadId` first). None of this has been exercised against a live Gmail account from within a coding session (no network access); real bugs in it have so far only surfaced from the user's own manual testing against their real inbox — treat it as the least-proven module in the codebase.

**Dashboard & search** — the home page (`src/app/(protected)/page.tsx`) surfaces contacts due for follow-up (`Contact.nextFollowUpAt`, via `listContactsForUser(userId, { followUpDue: true })`) and a pending-triage count. Note: `Application` has no equivalent follow-up field — it was removed in the issue #17 pass, so the dashboard's follow-up section is contacts-only, not the "applications and contacts" `PLAN.md` originally described. `src/lib/search.ts` + `/search` is a case-insensitive `contains` search across `Application`/`Contact`/`Interaction`, surfaced via a plain GET-form search box in `Nav.tsx` (no client JS needed).

## Key Patterns

**Server Actions** are the mutation layer — every create/update/delete is a `"use server"` function in an `actions.ts` file colocated with its route. Pages are async RSC that fetch directly via `prisma`; all data-fetching pages export `dynamic = "force-dynamic"`.

**Ownership checks:** `Entry`, `Resume`, custom `Category`, and every tracker model (`Company`/`Application`/`Contact`/`Interaction`/`ApplicationContact`/`EmailThread`) have a required/nullable `userId`. Prisma's singular `update`/`delete`/`findUnique` build their `where` from unique fields only — adding `userId` alongside `id` there does **not** enforce ownership. Always use `updateMany`/`deleteMany` with `{ id, userId }` in `where` and check the returned `count` (0 means not found or not owned → `notFound()`), and use `findFirst` (not `findUnique`) with `{ id, userId }` for ownership-checked reads. Built-in categories have `userId: null`; category lookups that should include them use `where: { OR: [{ userId: null }, { userId }] }`. **The one legitimate exception** is `GmailAccount`, whose `userId` field is itself `@unique` (one row per user) — `findUnique`/`update` keyed on `userId` alone is correct there, not a bypass, because `userId` *is* the unique key, not a secondary filter alongside a different one. Don't generalize that exception to any other model. A Phase 4 audit found one real ownership-check miss in `confirmEmailThreadMatchForUser` (a caller-supplied `contactId`/`applicationId` was written without verifying it belonged to the caller) — if you're touching anything that accepts a foreign id from client input, check that it's actually owned by `userId` before using it, not just the row being updated.

**Client-safe shared modules:** when a client component needs a server module's pure constants/types/CSV-or-matching logic (e.g. `APPLICATION_STATUSES`, a status-history formatter), split that pure logic into its own `*Shared.ts` file with **no runtime import of `@/lib/prisma`** (only `import type` from `@prisma/client`, which is erased at compile time) — see `applicationsShared.ts`, `interactionsShared.ts`, `notionImportShared.ts`. Importing the Prisma-touching lib file directly from a client component bundles the Prisma client into client-side JS. The `*.ts` file (no `Shared`) stays server-only and re-exports its `*Shared.ts` counterpart (`export * from "./xShared"`) so server code can import everything from one place.

**shadcn/ui here uses `@base-ui/react`**, not Radix UI. Important differences:
- `Button` has no `asChild` prop — use `buttonVariants` on a `<Link>` instead: `<Link className={cn(buttonVariants({ variant: "outline" }))}>`
- `Select.Value` renders the raw value string, not the selected item's label — render the label manually in the trigger
- `Checkbox` renders as `<button>`, not `<input>` — native `<label>` won't forward clicks to it; use a `<div onClick>` with `pointer-events-none` on the Checkbox
- `AlertDialog` does not use a Trigger in this codebase — manage `open` state manually

**Rich text in bullets/descriptions** is stored as plain strings with `**bold**` and `*italic*` markers. `applyFormatting()` in `src/templates/jake.ts` converts these to `\textbf{}` / `\textit{}` after LaTeX-escaping. The preview parses them to `<strong>` / `<em>` in `EntryForm.tsx`.

**Entry field visibility** is driven by `src/lib/entryFields.ts`. `FIELD_CONFIGS` maps category slugs to `FieldConfig` objects that control which fields render in `EntryForm`. Add a new built-in category type by adding an entry to `FIELD_CONFIGS`; custom categories fall back to `DEFAULT_FIELD_CONFIG` (all fields).

**PDF compilation** is centralized in `src/lib/resumeCompiler.ts`'s `compileResumeToPdf(templateId, identity, entriesByCategory)` — the pdflatex/tempdir/cleanup mechanics (write `.tex`, run `pdflatex` twice with a timeout, read the PDF, clean up in `finally`) live here exactly once. Both `GET /api/pdf/[resumeId]` (DB-backed, session-authenticated) and the MCP `compile_resume` tool (inline data, bearer-token-authenticated) call this same function — the DB route does its own Prisma fetch/grouping into `EntriesByCategory` first, then hands off; the MCP tool builds `EntriesByCategory` from inline request data instead. Any future template-selection or pdflatex-invocation change belongs here, not duplicated in a route.

**LaTeX template** lives entirely in `src/templates/jake.ts`. `escapeLatex` → `applyFormatting` → template string. Education uses `\resumeSubheading{school}{location}{degree}{date}` (location is arg #2, date is arg #4) — this differs from Experience where date is arg #2.

**Do not edit the static LaTeX in `jake.ts`** (the preamble, custom commands like `\resumeItem`/`\resumeSubheading`, margins, `\titleformat`) without a deliberate decision to diverge from upstream. The template must stay byte-for-byte identical to the canonical upstream template (https://github.com/jakegut/resume/blob/master/resume.tex — the "Jake Ryan" resume, credited in `jake.ts`'s own header comment) except for one documented, necessary exception:

- `\usepackage[T1]{fontenc}` + `\usepackage[utf8]{inputenc}` — added in commit `ac0dc83` (2026-09-06). Upstream doesn't need these because it's a static example with hardcoded ASCII sample text; ResumePress renders arbitrary user-entered Unicode (accented names like "José", "Renée"). Verified by direct testing: without these packages, modern pdfTeX doesn't crash, but accented characters render/extract as decomposed glyphs (e.g. "í" → "ı" + floating accent mark) — a real, visible defect, not just cosmetic. This is the one deviation from upstream; everything else (margins, custom commands, section layout) matches exactly.

Run `npm run check:jake-template` after any change to `jake.ts` — it renders the template with fixed dummy data and diffs the output against the golden fixture at `src/templates/__fixtures__/jake.golden.tex`, failing loudly (with a line-level diff) on any unintended change. If a change to the static LaTeX is genuinely needed, update the golden fixture *and* add the new discrepancy to the list above in the same commit — don't let the two drift apart.

**Card spacing gotcha:** The shadcn Card applies `py-(--card-spacing)` (16px) to itself plus `gap-(--card-spacing)` between children. For list-row cards that use `CardContent` with its own `py-*`, add `py-0` to the `Card` to avoid double-stacking vertical padding.

## Data Model

```
User      id, name?, email?, image?  (+ NextAuth Account/Session/VerificationToken)
Category  id, name, slug, isBuiltIn, userId?  ← null = global built-in, set = a user's custom category
Entry     id, title, displayTitle?, organization?, location?, startDate?, endDate?,
          description?, bullets[], url?, tags[], categoryId, userId
          ← title is what renders into the PDF; displayTitle is a UI-only override with no PDF effect
Resume    id, name, templateId ("jake"), identity (JSON), entries[], userId
ResumeEntry  resumeId, entryId, order  ← join table; order controls PDF ordering
ApiToken  id, name, tokenHash (unique), userId, lastUsedAt?, expiresAt?, revokedAt?  ← bearer tokens for MCP/agent auth, see "MCP Server" above

Company   id, name, website?, tier?, notes?, userId
Application  id, companyId, roleTitle, term?, status ("Applied" default, free-form),
          appliedAt?, postingUrl?, location?, source?, resumeId?, notes?, externalId?, userId
          ← externalId is set by the Notion/CSV importer so re-imports are idempotent
ApplicationStatusHistory  id, applicationId, fromStatus?, toStatus, note?, changedAt, userId
          ← written automatically on every Application.status change (same transaction);
            note-only rows (fromStatus === toStatus) are a user-authored "log update", not a status change
Contact   id, name, companyId?, title?, emails[], linkedinUrl?, phone?, howMet?, metAt?,
          notes?, tags[], nextFollowUpAt?, userId
ApplicationContact  applicationId, contactId, role (free-form), userId  ← composite @@id([applicationId, contactId])
Interaction  id, type (free-form), occurredAt, summary, contactId?, applicationId?,
          emailThreadId?, userId
          ← contactId/applicationId are both independently nullable; an interaction can belong to either, both, or neither
EmailThread  id, gmailThreadId, subject?, snippet?, participants[], lastMessageAt?, gmailUrl?,
          matchedContactId?, matchedApplicationId?, matchStatus ("unmatched" default: auto|confirmed|unmatched|ignored), userId
          ← @@unique([userId, gmailThreadId]); stores metadata/snippet only, never full message bodies
GmailAccount  id, userId (unique — see "Key Patterns" ownership-check exception), email,
          encryptedRefreshToken, scopes[], syncLabelIds[], historyId?, lastSyncAt?, connectedAt
```

`identity` JSON shape: `{ name, email, phone, website, linkedin, github }`.

Built-in category slugs: `experience`, `education`, `projects`, `skills`. These slugs are matched in `renderSection()` in `jake.ts` to determine which LaTeX render function to call.

## Adding a New Template

1. Create `src/templates/<name>.ts` exporting a `render(identity, entriesByCategory)` function with the same signature as `jake.ts`.
2. Register it in `TEMPLATE_RENDERERS` in `src/lib/resumeCompiler.ts`.
3. Add it to the `TEMPLATES` array in `src/app/(protected)/resumes/new/page.tsx`.
