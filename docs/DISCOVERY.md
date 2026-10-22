# Discovery: ResumePress as it exists today

Phase 0 output. Read-only survey of the current codebase, no code changes. Written 2026-10-22 against commit `da07911` (main, clean).

## 1. Stack and versions

From `package.json` / `tsconfig.json`:

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js, App Router | `16.3.4` |
| Language | TypeScript, `strict: true` | `^5` |
| UI runtime | React / React DOM | `19.2.8` |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) | `^4` |
| Components | shadcn/ui, **base-ui variant** (`@base-ui/react`, not Radix) | `^1.8.0` |
| ORM | Prisma Client + CLI | `^5.22.0` (`@prisma/client` matches) |
| Database | PostgreSQL | `16` (both local Docker and production) |
| Auth | Auth.js (NextAuth) v5 beta, Google provider only, `@auth/prisma-adapter` | `next-auth@^5.0.0-beta.32`, adapter `^2.11.3` |
| Validation | Zod | `^3.25.76` |
| PDF toolchain | `pdflatex` (TeX Live), invoked via `child_process.exec` | TeX Live via `apt-get` in Docker; `mactex-no-gui` for local |
| MCP | `@modelcontextprotocol/sdk` | `^1.30.0` |

No ORM/DB alternative (Drizzle etc.) is present. No test framework (Vitest, Jest, Playwright) is installed — `devDependencies` has none, and there are no `*.test.*`/`*.spec.*` files anywhere in the repo. No `.github/workflows` directory exists — **there is no CI today**. The only pre-merge checks are manual: `npx tsc --noEmit` and `npm run build`, per `CONTRIBUTING.md`.

Note: this repo also carries `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.devin/skills/` directories, all containing a `prisma-composer-core-concepts` skill. This is an injected agent-tooling skill, unrelated to the app's actual ORM — the app uses plain `@prisma/client`/`prisma`, not `@prisma/composer`. Ignore it as a signal about the real stack.

## 2. Database and schema

`prisma/schema.prisma` — single Postgres datasource, `DATABASE_URL` env var. Models (all ids are `cuid()` strings):

- `User` — NextAuth user (`name?`, `email? @unique`, `emailVerified?`, `image?`), has `accounts`, `sessions`, `entries`, `resumes`, `categories`, `apiTokens`.
- `Account`, `Session`, `VerificationToken` — standard Auth.js adapter tables. `Account` is unique on `[provider, providerAccountId]` and already has `refresh_token`/`access_token`/`scope`/`expires_at` columns (currently populated only for the login-scope Google grant).
- `Category` — `name`, `slug`, `isBuiltIn`, `userId?` (nullable = global built-in). Unique on `[userId, slug]`.
- `Entry` — `title` (PDF text), `displayTitle?` (UI-only override), `organization?`, `location?`, `startDate?`, `endDate?`, `description?`, `bullets String[]`, `url?`, `tags String[]`, `categoryId`, `userId` (**required**), timestamps.
- `Resume` — `name`, `templateId @default("jake")`, `identity Json?`, `userId` (**required**), timestamps.
- `ResumeEntry` — join table, composite id `[resumeId, entryId]`, plus `order Int` (controls PDF ordering).
- `ApiToken` — `name`, `tokenHash @unique`, `userId`, `lastUsedAt?`, `expiresAt?`, `revokedAt?`.

Migrations (`prisma/migrations/`, 5 total, oldest to newest): `20260906_init`, `20260907000000_add_entry_pdf_title`, `20260907010000_add_auth_and_user_scoping`, `20260907020000_require_entry_resume_userid`, `20260908000000_add_api_token`, `20260914000000_rename_entry_pdftitle_to_displaytitle`. History shows the schema moved from no-auth/single-tenant to required per-user scoping in two steps (add nullable `userId`, then a follow-up migration making it `NOT NULL`) — the same two-step pattern will likely be needed for any new required FK added after rows already exist.

Run migrations: `npm run db:migrate` (`prisma migrate dev`, requires a running local Postgres per `DATABASE_URL`). Seed built-ins: `npm run db:seed` (`prisma/seed.ts`, same four categories as `docker-entrypoint.sh` seeds in prod). Inspect data: `npm run db:studio`.

**Production database**: confirmed via the Sevalla API (see §5) — a managed Postgres 16 instance (`resumepress-db-g597z`, size `db1`), separate from the app's compute. Not a Neon/Supabase/serverless Postgres.

## 3. Authentication — two independent systems

Documented in `CLAUDE.md` and verified against `src/lib/auth.ts` / `src/lib/apiToken.ts`:

- **Browser/session**: Auth.js v5, Google OAuth only, `session: { strategy: "database" }`, `trustHost: true` (needed because production sits behind Sevalla's reverse proxy). `pages: { signIn: "/login" }`. **There is no route-level auth gate anywhere** — every page renders for both logged-in and logged-out visitors; a logged-out visitor just sees empty entry/resume lists. Two helpers, both in `src/lib/auth.ts`:
  - `getUserId()` — returns `session.user.id` or `null`, never redirects. Used by pages/reads.
  - `requireUserId()` — redirects to `/login` if unauthenticated. Used by server actions (writes only).
- **Agent/API-key**: `src/lib/apiToken.ts`. `rp_`-prefixed random tokens, only the SHA-256 hash is stored (`ApiToken.tokenHash`). `getUserIdFromBearerToken(req)` reads `Authorization: Bearer <token>`, hashes, looks up, checks `revokedAt`/`expiresAt`, bumps `lastUsedAt`. Managed at `/settings/tokens` (`src/app/settings/tokens/{page.tsx,actions.ts,TokenCreateForm.tsx}`), itself session-gated via `requireUserId()`. Fully independent of NextAuth sessions/cookies — this is what the MCP server uses.

**Important for the Gmail-sync plan**: the current Google provider in `auth.ts` is `Google` with **no extra `authorization.params`** — it requests only default login scopes (`openid email profile`), not `gmail.readonly`, and does not force `access_type=offline`/`prompt=consent`. It is not currently wired to request or persist a long-lived Gmail refresh token. See `MIGRATION_PLAN.md` for how to add that without disturbing login.

## 4. Resume compilation (LaTeX toolchain)

Centralized in `src/lib/resumeCompiler.ts`, `compileResumeToPdf(templateId, identity, entriesByCategory)`:

1. Looks up a renderer in `TEMPLATE_RENDERERS` (today: only `{ jake: render }`, from `src/templates/jake.ts`); unknown ids silently fall back to `jake` **in this function**.
2. Renders the LaTeX source as a string.
3. `mkdtemp`s a scratch dir under `os.tmpdir()`, writes `resume.tex`.
4. Shells out to `pdflatex -interaction=nonstopmode -output-directory="<tmp>" "<tmp>/resume.tex"` **twice** (needed to resolve any cross-references), each capped at `PDFLATEX_TIMEOUT_MS = 15_000` ms via `child_process.exec` + `promisify`.
5. Reads `resume.pdf` back into a `Buffer`.
6. `finally`-block `rm -rf`s the temp dir regardless of success/failure.

Two callers:
- `GET /api/pdf/[resumeId]` (`src/app/api/pdf/[resumeId]/route.ts`) — session-authenticated (`auth()`), fetches the `Resume` + ordered `ResumeEntry`→`Entry`→`Category` from Prisma, groups by category preserving selection order, calls `compileResumeToPdf`, streams the PDF back with `Content-Disposition: attachment`. On failure, logs `pdflatex error:` and returns a 500 with the raw error message in the JSON body (worth tightening before this becomes a multi-module app — see Risks).
- MCP tool `compile_resume` (`src/lib/mcpTools.ts`) — bearer-token-authenticated, builds `EntriesByCategory` from fully inline request data (validated by `compileResumeSchema` in `src/lib/schemas/resumeEntry.ts`, which caps section/entry/bullet counts and string lengths and treats an unknown `templateId` as a hard validation error — the one place that differs from the DB route's silent fallback). Never touches Prisma; nothing is persisted.

**The template itself** (`src/templates/jake.ts`, 286 lines) is treated as a frozen artifact: `escapeLatex` → `applyFormatting` (converts `**bold**`/`*italic*` markers to `\textbf{}`/`\textit{}`) → a LaTeX template string matching Jake Gutierrez's canonical Overleaf resume byte-for-byte, except one documented deviation (added `fontenc`/`inputenc` packages for Unicode name support, commit `ac0dc83`). `npm run check:jake-template` (`scripts/check-jake-template.ts`) renders fixed dummy data and diffs against `src/templates/__fixtures__/jake.golden.tex`, failing loudly on drift. Education's `\resumeSubheading` has date in arg #4 vs. Experience's arg #2 — a template-specific gotcha, not something new code should need to touch.

`pdflatex` must exist on `PATH`. Locally that means `brew install --cask mactex-no-gui`; everywhere else it comes from the Docker image (see §5). There is **no sandboxing** of the LaTeX run beyond the timeout — `pdflatex -interaction=nonstopmode` with user-controlled (but escaped) content from `identity`/entries.

## 5. Deployment

- **Local**: `docker-compose.yml` — Postgres 16 Alpine + the app's own Dockerfile build, `DATABASE_URL` pointed at the `db` service. `docker compose up`.
- **Dockerfile** — multi-stage, `node:20-slim` base. Installs `texlive-latex-base`, `texlive-latex-extra`, `texlive-fonts-recommended`, `texlive-fonts-extra`, `cm-super` (the last one fixes a ligature/copy-paste Unicode bug, see memory `project_pdf_copypaste_encoding`) via `apt-get`. `deps` stage runs `npm ci --ignore-scripts`; `builder` stage runs `prisma generate` then `next build`; `runner` stage copies the Next `output: "standalone"` bundle (`next.config.ts`), `.next/static`, `public`, the generated Prisma client + CLI + `prisma/` (migrations ship in the image), then runs `docker-entrypoint.sh`.
- **`docker-entrypoint.sh`** — `prisma migrate deploy`, then an inline Node script that upserts the four built-in categories (idempotent, `findFirst` + `create` if missing), then `node server.js`.
- **Production**, confirmed live via the Sevalla MCP tools (not just docs):
  - App `resumepress-trft1` (project `ResumePress`), source `privateGit` → `github.com/gpenland/ResumePress`, `build_type: dockerfile`, `auto_deploy: true` on `main`. One `web` process, size `s1` (500 millicores / 1000 MB), port 3000.
  - Domains: `resumepress.graysonpenland.com` (custom, SSL active) and the Sevalla-assigned `resumepress-trft1.sevalla.app`.
  - Database: `resumepress-db-g597z`, managed Postgres 16, size `db1`, separate service from the app.
  - Latest deployment (`da07911`, the current HEAD) built and deployed successfully (`deploymentSuccess`) in ~2 minutes.
  - **This means the "can this platform run pdflatex" question is already answered in production, today** — not hypothetical. See `MIGRATION_PLAN.md` §3 (hosting).

Required env vars (from `README.md`): `DATABASE_URL`, `AUTH_SECRET` (`npx auth secret`), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, with the Google OAuth client's authorized redirect URI set for both `http://localhost:3000/api/auth/callback/google` and the production domain's equivalent.

## 6. Tests

None. No test files, no test runner installed, no CI workflow. The only automated guard against regressions is `check:jake-template` (a golden-file diff script, not a test-runner-based test) plus TypeScript's `strict` mode and `next build`. This is a real gap relative to PLAN.md §5's "Vitest for unit tests, Playwright for end-to-end" and §2's "tests alongside features" — Phase 1 has to introduce the test/CI infrastructure from scratch, not extend existing infrastructure.

## 7. Notable tech debt / risks observed

1. **No CI, no tests.** Nothing currently blocks a bad PR from merging except manual `tsc`/`build` discipline.
2. **No route-level auth gate on the existing ResumePress pages.** Every page renders for anonymous visitors (empty-state only). PLAN.md §2 principle 5 ("every route and API handler checks auth," owner-allowlisted) is a stricter posture than today's and needs a conscious decision about whether it applies only to the new modules or retroactively to ResumePress too (see `MIGRATION_PLAN.md` open questions).
3. **Google provider doesn't currently request `gmail.readonly` or persist a refresh token** — adding Gmail sync is not just "read from the `Account` table," it needs its own authorization-params/token-handling work (detailed in `MIGRATION_PLAN.md`).
4. **`GET /api/pdf/[resumeId]` returns the raw caught error message in its JSON 500 response** (`detail: message`). Low risk today (pdflatex errors, not secrets), but worth tightening if this pattern gets copied for new API routes.
5. **Working tree has an unrelated uncommitted change**: `FUTURE_FEATURES.md` shows as deleted (not staged, not committed) in `git status`, predating this session. Not touched as part of this discovery pass (see ground rule: never delete files) — flagging so it isn't lost by accident later.
6. **`compileResumeToPdf`'s silent `jake` fallback for an unknown `templateId`** is intentional per `CLAUDE.md` for the DB-backed route (vs. the MCP tool's hard validation error) — fine today with one template, but worth remembering once "Adding a New Template" (`CLAUDE.md`) actually gets exercised.
