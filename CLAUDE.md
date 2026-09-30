# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

Postgres must be running for `dev` and `db:*` commands. `.env` needs `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/resumepress?schema=public`, plus `AUTH_SECRET` (generate with `npx auth secret`), `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` from a Google Cloud OAuth 2.0 Web application client (authorized redirect URI: `<origin>/api/auth/callback/google`, for both `http://localhost:3000` and the Sevalla production domain).

## Architecture

**Stack:** Next.js 16 App Router · TypeScript · Tailwind CSS v4 · Prisma 5 + PostgreSQL · shadcn/ui (base-ui variant)

**PDF generation:** `GET /api/pdf/[resumeId]` fetches the resume + selected entries from the DB and groups them by category, then hands off to `compileResumeToPdf` (`src/lib/resumeCompiler.ts`, see "Key Patterns"), which renders via `src/templates/jake.ts`, writes the `.tex` to a temp dir, runs `pdflatex` twice, and returns the PDF buffer for the route to stream back. The same `compileResumeToPdf` is also called by the MCP `compile_resume` tool (see "MCP Server") for DB-free, inline compiles. pdflatex must be installed locally (`brew install --cask mactex-no-gui`) or is included in the Docker image via `apt-get install texlive-*`.

**Deployment:** Docker + Sevalla. `docker-entrypoint.sh` runs `prisma migrate deploy`, seeds categories, then `node server.js`. `next.config.ts` uses `output: "standalone"`.

**Auth:** two independent auth systems, for two different kinds of client.

- **Browser/session auth** — NextAuth.js (Auth.js v5) with Google OAuth only, configured in `src/lib/auth.ts` (database session strategy via `@auth/prisma-adapter`). There is **no route-level auth gate** — every page renders for everyone, logged in or not; a logged-out visitor just sees no entries/resumes. The nav (`src/components/Nav.tsx`) shows a "Sign in" button when logged out, or `UserMenu` (avatar + sign-out) when logged in. Two helpers from `src/lib/auth.ts`:
  - `getUserId()` — for pages/reads. Returns the session's user id or `null`; never redirects. Pages branch on `null` to render an empty list (list pages) or call `notFound()` before querying (detail/edit pages for a specific id — never let `userId` be `undefined` in a `where` clause, since Prisma treats `undefined` as "field omitted" and would query across all users).
  - `requireUserId()` — for server actions that write data. Redirects to `/login` if there's no session (this is the only place unauthenticated users get redirected — submitting a create/update/delete while logged out).
- **Agent/API-key auth** — a separate bearer-token mechanism in `src/lib/apiToken.ts`, purpose-built for non-browser clients (the MCP server below). `generateApiToken()` mints a `rp_`-prefixed random token and stores only its SHA-256 hash; `getUserIdFromBearerToken(req)` reads the `Authorization: Bearer <token>` header, hashes it, looks up the `ApiToken` row, checks `revokedAt`/`expiresAt`, bumps `lastUsedAt`, and returns the associated `userId` (or `null`). Users create/revoke tokens at `/settings/tokens` (session-authenticated page, uses `requireUserId()`). This system never touches NextAuth sessions or cookies.

## MCP Server

`src/app/api/mcp/route.ts` exposes ResumePress over the Model Context Protocol (`@modelcontextprotocol/sdk`) so agents (e.g. a Claude.ai custom connector) can work with a user's resume data via a bearer token instead of a browser session. The `POST` handler authenticates via `getUserIdFromBearerToken`, builds a per-request `McpServer`, and calls `registerResumePressTools(server, userId)` (`src/lib/mcpTools.ts`) before handing the request to the SDK's streamable-HTTP transport.

Tools registered, all scoped to the authenticated `userId`:
- `list_categories`, `list_entries`, `get_entry`, `list_resumes`, `get_resume` — read-only, delegate to `src/lib/categories.ts` / `entries.ts` / `resumes.ts`.
- `create_entry`, `create_resume` — persist new rows via the same lib functions the server actions use.
- `compile_resume` — the one tool that **never touches Prisma**. It takes identity + entries fully inline (no DB ids) and templateId, compiles a PDF via `compileResumeToPdf` (`src/lib/resumeCompiler.ts`), and returns the PDF as a base64 `resource`/`blob` content block in the same response. Nothing about the request or the compiled PDF is persisted — it's a stateless "compile and discard" path so an agent can iterate on resume content without ever creating real `Entry`/`Resume` rows. Its input is validated against `compileResumeSchema` (`src/lib/schemas/resumeEntry.ts`), which caps section/entry/bullet counts and string lengths since this path bypasses every guard the entry-form UI normally provides; an unrecognized `templateId` is a hard validation error here (unlike the DB-backed PDF route, which silently falls back to `jake`).

Tool input schemas are defined with zod directly in `mcpTools.ts` (mostly ad hoc per tool); `compile_resume`'s schema lives separately in `src/lib/schemas/resumeEntry.ts` so it can eventually be shared with `create_entry`/`create_resume`, which don't currently reuse any schema module.

## Key Patterns

**Server Actions** are the mutation layer — every create/update/delete is a `"use server"` function in an `actions.ts` file colocated with its route. Pages are async RSC that fetch directly via `prisma`; all data-fetching pages export `dynamic = "force-dynamic"`.

**Ownership checks:** `Entry`, `Resume`, and custom `Category` rows each have a required/nullable `userId`. Prisma's singular `update`/`delete`/`findUnique` build their `where` from unique fields only — adding `userId` alongside `id` there does **not** enforce ownership. Always use `updateMany`/`deleteMany` with `{ id, userId }` in `where` and check the returned `count` (0 means not found or not owned → `notFound()`), and use `findFirst` (not `findUnique`) with `{ id, userId }` for ownership-checked reads. Built-in categories have `userId: null`; category lookups that should include them use `where: { OR: [{ userId: null }, { userId }] }`.

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
```

`identity` JSON shape: `{ name, email, phone, website, linkedin, github }`.

Built-in category slugs: `experience`, `education`, `projects`, `skills`. These slugs are matched in `renderSection()` in `jake.ts` to determine which LaTeX render function to call.

## Adding a New Template

1. Create `src/templates/<name>.ts` exporting a `render(identity, entriesByCategory)` function with the same signature as `jake.ts`.
2. Register it in `TEMPLATE_RENDERERS` in `src/lib/resumeCompiler.ts`.
3. Add it to the `TEMPLATES` array in `src/app/resumes/new/page.tsx`.
