# Migration Plan: unifying ResumePress with the Applications tracker

Phase 0 output, companion to `docs/DISCOVERY.md`. Written 2026-10-22. No code changes made outside `docs/`.

## 1. Schema mapping: PLAN.md §3 onto the existing Prisma schema

The existing schema (`prisma/schema.prisma`) uses Prisma's convention of **singular PascalCase model names** (`User`, `Category`, `Entry`, `Resume`, `ResumeEntry`, `ApiToken`) with `cuid()` string ids and explicit `userId` ownership columns checked via the `findFirst`/`updateMany`+`count` pattern documented in `CLAUDE.md`. PLAN.md §3 names its new tables in **snake_case plural** (`companies`, `applications`, …), which is a different naming convention, not a different schema design. Recommendation: rename on adoption to match the existing codebase, since mixing conventions in one `schema.prisma` would be a constant source of confusion. Mapping:

| PLAN.md name | Prisma model name | Notes |
|---|---|---|
| `companies` | `Company` | New. |
| `applications` | `Application` | New. `resumeId String?` → `Resume.id` (nullable, matches PLAN.md §2 principle 1's spirit of "nothing required unless truly required" — here it's resume, not contact, that's optional by design). |
| `application_status_history` | `ApplicationStatusHistory` | New. Written automatically — do this inside the same server-action transaction that updates `Application.status`, not via a DB trigger (keeps the "Server Actions are the mutation layer" pattern from `CLAUDE.md` intact; a trigger would be a second, invisible mutation path). |
| `contacts` | `Contact` | New. |
| `application_contacts` | `ApplicationContact` | New join table, same shape as `ResumeEntry` (composite key or own `id` + unique `[applicationId, contactId]`, plus `role`). |
| `interactions` | `Interaction` | New. `contactId String?`, `applicationId String?` — both nullable per PLAN.md §2 principle 1 and §4's "contacts can exist with no application at all." |
| `email_threads` | `EmailThread` | New. |
| `oauth_accounts` | **Not `OAuthAccount` as a generic name — see §2 below, "Gmail tokens."** | Needs its own design decision, not a 1:1 rename. |

All new models get `userId String` (required, matches `Entry`/`Resume`, **not** `Category`'s nullable pattern — there's no "built-in" company/contact/application analog to `Category.isBuiltIn`). Even though PLAN.md frames this as a single-user app, the existing schema and auth are already multi-user-capable (`User` has many `entries`/`resumes`/`categories`); keeping the same `userId` + ownership-check pattern on the new tables costs nothing today and avoids a second, inconsistent authorization model if that assumption ever changes. All new models use `cuid()` ids to match.

### Conflicts and things that don't map cleanly

1. **`oauth_accounts` overlaps with Auth.js's existing `Account` model.** `Account` already has `refresh_token`, `access_token`, `scope`, `expires_at` columns and is unique on `[provider, providerAccountId]` — on paper, the data NextAuth needs. But:
   - It's owned and written by `@auth/prisma-adapter`, not by app code. Relying on it for Gmail sync means fighting the adapter's own write path whenever the user re-authenticates or the adapter version changes.
   - Requesting `gmail.readonly` as an **incremental** scope (user already has a login-only grant) on the *same* `[provider, providerAccountId]` row risks the adapter treating it as an update-in-place with no guarantee the new refresh token lands, since NextAuth doesn't re-persist tokens on every sign-in by default.
   - **Recommendation**: a dedicated `GmailAccount` model (`userId`, `encryptedRefreshToken`, `scopes String[]`, `historyId?`, `lastSyncAt?`, `connectedAt`), populated by a **separate, explicit "Connect Gmail" OAuth flow** (its own `/api/gmail/oauth/{start,callback}` routes using `googleapis` directly with `access_type=offline&prompt=consent&scope=.../gmail.readonly`), fully decoupled from `auth()`/`Account`. This is exactly PLAN.md §3's `oauth_accounts` row, just named for what it actually is instead of a generic catch-all.
   - **This reuses the same Google Cloud OAuth client** (`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`) — a Google OAuth client isn't scope-locked, so the only Google Cloud change needed is adding one more authorized redirect URI (`<origin>/api/gmail/oauth/callback`) to the existing Web application client, plus adding `gmail.readonly` to the OAuth consent screen's scope list. No second client, no new credentials. What *can't* be reused is NextAuth's own `signIn()`/`Account` plumbing — that's a separate code path (plain `googleapis` auth URL + token exchange), not a separate app registration. (Resolves open question 2 below.)
   - Refresh tokens must be encrypted at rest per PLAN.md §4 — needs a new secret (e.g. `GMAIL_TOKEN_ENCRYPTION_KEY`, 32 bytes, distinct from `AUTH_SECRET`) and a small `src/lib/encryption.ts` (AES-256-GCM is the standard choice; Node's built-in `crypto` needs no new dependency).

2. **No route-level auth gate today vs. PLAN.md §2.5 "every route and API handler checks auth."** **Resolved (owner, 2026-10-22): gate the whole app**, not just the new tracker routes. Implementation: a single check in the root layout or Next.js middleware — `session.user.email === OWNER_EMAIL` — redirecting anyone else to `/login`, applied to every route including today's ResumePress pages. One rule instead of two postures to maintain.
   - **This is additive, not a replacement for the existing Prisma-level `userId` scoping.** The gate answers "can this person use the app at all"; the ownership-check pattern in `CLAUDE.md` ("Key Patterns" — `findFirst`/`updateMany` with `{ id, userId }`) answers "can this session's user touch this specific row." Keep both. Once the gate is in place there will only ever be one real signed-in user (the owner), so the `userId` scoping becomes *redundant in practice* for cross-user isolation — but it stays as defense-in-depth: it's what stops a bug in the gate, a future second allowlisted user, or the MCP bearer-token path (which has its own, separate auth and isn't touched by this gate at all) from ever reading or writing another identity's rows. **Do not remove or loosen any existing `userId` filter/ownership check as part of adding the gate.**
   - **What the gate does make redundant**: the current per-page pattern of calling `getUserId()` and branching on `null` to render an empty list (`CLAUDE.md`: "pages branch on null to render an empty list"). Once the gate guarantees a valid owner session before any page renders, that branch can never actually trigger for a page the gate protects. Recommend leaving that code as-is in Phase 1 rather than ripping it out — it's a harmless, cheap fallback (defends against a gate misconfiguration or future gate bypass), and rewriting every list page to assume a non-null `userId` is a refactor with no functional benefit, not something Phase 1 needs to do. `CLAUDE.md`'s "no route-level auth gate" line will need updating once the gate ships, since it'll no longer be true.

3. **`application_status_history` "written automatically"** has no existing analog — nothing in today's schema auto-derives a second row from a mutation. Straightforward to add (transaction in the server action), just flagging it's new *pattern*, not just a new *table*.

4. **Resume link is the only truly trivial piece**: `Application.resumeId String?` → `Resume.id`, no cascade needed (an application should survive a resume being edited/renamed; if a linked `Resume` is ever deletable, use `onDelete: SetNull`, not `Cascade`, so deleting a resume doesn't delete application history).

5. **CSV import/export and the Notion importer** (PLAN.md §4/§6 Phase 3) have no schema conflict — they're pure I/O against the new tables — but will want a `source` discriminator or `externalId` column on `Application`/`Contact` to make the importer idempotent on re-run. Worth adding in Phase 1's migration even though the importer itself is Phase 3, since adding a column later is cheap and adding it retroactively after rows exist is the two-step migration dance seen in `prisma/migrations/20260907010000_*` → `20260907020000_*`.

## 2. Recommended stack: keep what's there

PLAN.md §5 lists defaults and says to override only if the existing stack blocks the plan. Nothing does. Specific deltas from the PLAN.md defaults, and why:

| PLAN.md default | Recommendation | Why |
|---|---|---|
| Drizzle ORM | **Keep Prisma 5** | 5 migrations, every ownership-check pattern in `CLAUDE.md`, and both `src/lib/*.ts` data modules and `mcpTools.ts` are written against the Prisma client. Switching ORMs mid-project is a full rewrite of every data-access file for zero functional gain — nothing in the new feature set needs anything Prisma can't do. |
| Postgres via Neon or Supabase | **Keep the existing Sevalla-managed Postgres 16** (`resumepress-db-g597z`) | It's already in production, already the target of `prisma migrate deploy` in `docker-entrypoint.sh`. Moving to Neon/Supabase would mean a data migration and a new connection-pooling story for no stated benefit — PLAN.md's default was written before Phase 0 established what's actually running. |
| Auth.js with Google provider | **Keep as-is**, extend for Gmail (see §1.1) | Already exactly this. |
| shadcn/ui + Tailwind | **Keep, but note the base-ui variant** | `CLAUDE.md`'s documented base-ui quirks (`Button` has no `asChild`, `Select.Value`, `Checkbox` as `<button>`, manual `AlertDialog` state) apply to every new component the tracker module adds — copying patterns from standard shadcn/Radix docs will produce bugs. |
| TanStack Table for grids | **Keep as default**, decide AG Grid Community / Glide Data Grid only after Phase 2A's first grid is built | No existing grid component to migrate from, so this is a clean "build new" decision, not a "replace existing" one — defer to whoever builds Module A, per PLAN.md's own escape hatch ("move... only if copy/paste ranges or heavy keyboard navigation are needed"). |
| Zod for validation | **Keep** | Already in use (`mcpTools.ts`, `src/lib/schemas/resumeEntry.ts`). |
| Vitest + Playwright, CI on GitHub Actions | **CI only for now (`tsc --noEmit` + `npm run build`), no test framework** — owner decision, 2026-10-22 | `docs/DISCOVERY.md` §6: there is currently zero test tooling and no CI. CI is still net-new work. Test frameworks are explicitly deferred; see the risk this introduces in §6 below. |

**No stack changes recommended.** The one genuinely new piece of infrastructure is encryption-at-rest for Gmail refresh tokens (§1.1) — a small addition (Node's built-in `crypto`), not a new dependency or service.

## 3. Hosting recommendation

PLAN.md §5's "key risk" — can the host run `pdflatex` — **is already resolved in production, not hypothetical.** Verified live via the Sevalla MCP tools (not just reading docs):

- App `resumepress-trft1` is already deployed on Sevalla from this same repo, `build_type: dockerfile`, using the exact `Dockerfile` in `docs/DISCOVERY.md` §5 (TeX Live baked into the image), `auto_deploy: true` on `main`.
- It's been deploying successfully on every push for weeks (latest: commit `da07911`, `deploymentSuccess`, ~2 min build).
- It already has a managed Postgres 16 database as a sibling service, and a working custom domain (`resumepress.graysonpenland.com`) with active SSL.
- Sevalla's application model supports `web`, `worker`, `cron`, and `job` process types from one Dockerfile/repo (confirmed via the platform API schema) — which directly covers PLAN.md §4's "manual Sync now plus a scheduled incremental sync" requirement for Gmail without adding any new infrastructure (a `cron` process hitting an internal sync endpoint, or a dedicated `worker` process, both run from the same image).

**Recommendation: stay on Sevalla (PLAN.md §5 option 1 — Docker-capable host with TeX in the image). This is not a new decision to make, it's confirming the one already made and running.** Tradeoffs against the other two PLAN.md options, for completeness:

| Option | Tradeoff |
|---|---|
| **1. Docker host with TeX in image (current, recommended)** | Zero migration cost — already running. Only real downside is image size/build time from TeX Live (already paid) and that LaTeX compiles run on the same instance serving web traffic — fine at single-user scale (current `s1`: 500m CPU / 1GB RAM), would need its own process/queue if usage ever became multi-tenant/high-concurrency. |
| **2. Serverless app + separate containerized compile service** | Solves a scaling problem this app doesn't have. Adds a second deployable, a network hop, and auth between the two services, for a benefit (serverless cost/scaling) that doesn't apply to a single-owner app already paying for an always-on Sevalla instance. |
| **3. Switch to Tectonic (lighter compile, serverless-friendly)** | Would let you drop TeX Live and go serverless, but `check:jake-template`'s golden-file diff exists specifically because the LaTeX output must stay byte-identical to the upstream template — swapping the compiler is exactly the kind of change that golden fixture is designed to catch regressions in. Worth doing only if a future scaling need actually materializes; not justified by this merge. |

One real gap to close in Phase 1, not a hosting *platform* change: add the Gmail sync's cron/worker process definition to the Sevalla app config, and make sure `GMAIL_TOKEN_ENCRYPTION_KEY` and any Gmail-specific client secret are added via Sevalla's environment-variable management alongside the existing `AUTH_*`/`DATABASE_URL` vars.

## 4. Phase 1 task list (foundation, single agent, stop for review after)

1. **Branch**: `feature/tracker-foundation` off `main`.
2. **CI**: add `.github/workflows/ci.yml` running `npx tsc --noEmit` and `npm run build` on PRs to `main`. No test framework for now (owner decision, 2026-10-22) — see the risk this introduces in §6.
3. **Schema migration (additive only)**: add `Company`, `Application`, `ApplicationStatusHistory`, `Contact`, `ApplicationContact`, `Interaction`, `EmailThread`, `GmailAccount` to `prisma/schema.prisma` per §1 above, all with required `userId`. New Prisma migration via `npm run db:migrate`; verify `prisma migrate deploy` still runs cleanly against a copy of the production DB (or at minimum, a fresh seed) before merging — this is additive to a live, real-data database, not a greenfield one.
4. **Owner allowlist**: whole-app gate per §1.2 (resolved) — middleware or root-layout check of `session.user.email === OWNER_EMAIL`, redirecting everyone else to `/login`, covering existing ResumePress routes as well as the new tracker ones. Add `OWNER_EMAIL` env var (local `.env`, Sevalla). Leaves existing `userId` ownership checks and the `getUserId()`-null-branch pages untouched (§1.2).
5. **App shell**: nav entries for Applications/Contacts (extend `src/components/Nav.tsx`), top-level route stubs (`src/app/applications/page.tsx`, `src/app/contacts/page.tsx`) that just render "coming soon" so Phase 2 agents have a place to build into without colliding on the same new files.
6. **Gmail OAuth skeleton**: `src/lib/encryption.ts`, `GmailAccount` model (added in step 3) — nullable/absent by default so a user who never connects Gmail is unaffected everywhere else — `/api/gmail/oauth/start` + `/callback` routes that complete the handshake and store an encrypted token — but no sync logic yet (that's Phase 2C). Prove the token round-trips and decrypts.
7. **Secrets**: add `GMAIL_TOKEN_ENCRYPTION_KEY` (reusing the existing `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` client per §1.1 — no second OAuth client) to `.env.example`, local `.env`, and Sevalla's environment variables for `resumepress-trft1`.
8. **Deploy skeleton**: push the above to a preview/staging path if Sevalla supports it, or verify on `main` behind the allowlist gate that the new empty pages and the migrated schema deploy cleanly — reuse the existing app/DB, don't stand up a second one.
9. **Stop. User review.**

## 5. Phase 2 parallel split (one git worktree per agent, clear directory ownership)

Per PLAN.md §6: schema changes only through the Phase 1 migration process (any Phase 2 agent needing a column it doesn't have must request it, not add its own migration). Shared UI primitives (`src/components/ui/`) are foundation-owned; module agents add to their own subdirectory and request additions to shared ones.

| Module | Owns (new files/dirs) | Reads but doesn't modify | Notes |
|---|---|---|---|
| **A — Applications** | `src/app/applications/**`, `src/lib/applications.ts`, `src/lib/companies.ts`, `src/components/applications/**` | `src/lib/resumes.ts` (for the resume picker's data, not its UI) | Grid, kanban, detail page, status history, CSV import/export. Owns `Application`/`Company`/`ApplicationStatusHistory` CRUD. Stubs a plain `resumeId` field + a static "Open Resume" link in the detail page so Module D has a concrete slot to extend rather than editing Module A's file wholesale. |
| **B — Contacts & Interactions** | `src/app/contacts/**`, `src/lib/contacts.ts`, `src/lib/interactions.ts`, `src/components/contacts/**` | `src/app/applications/**` (read-only, to link interactions to an application id) | Grids, detail pages, quick-add (global keyboard shortcut lives in a shared layout — coordinate with Foundation, don't add it unilaterally to `src/app/layout.tsx`). Owns `Contact`/`Interaction`/`ApplicationContact` CRUD. |
| **C — Gmail sync** | `src/app/settings/gmail/**` (label picker, sync status), `src/app/triage/**`, `src/lib/gmail.ts`, `src/lib/emailThreads.ts` | `src/lib/encryption.ts`, `GmailAccount` (Foundation-owned, read/update only) | Builds on Phase 1's OAuth skeleton — adds label selection, manual "Sync now," the `historyId`-based incremental sync (as a Sevalla cron/worker process per §3), matching logic, and the triage queue UI. Must not touch `src/lib/auth.ts` or the `Account` model (see §1.1 — this is the whole reason Gmail tokens live in their own table). |
| **D — Resume integration** | `src/components/applications/ResumePicker.tsx`, `src/app/applications/resumeActions.ts` (a separate file from Module A's own `actions.ts` to avoid two agents editing the same file) | `src/app/applications/[id]/page.tsx` (only the specific slot Module A leaves for it — coordinate the exact insertion point in Phase 1 or as the very first merged Phase 2 PR) | Resume picker component, "Open resume" (reuses `GET /api/pdf/[resumeId]` as-is) and "Recompile" actions. Smallest module — likely finishes first and should rebase onto Module A rather than block it. |

Coordination risk flagged for the user's attention: Modules A and D both need to touch the application detail page. Cheapest fix is for Phase 1 (or module A's first commit) to leave an explicit, named extension point (e.g. a `<ResumeSection applicationId={...} />` import slot) before Module D's worktree is cut, so D never needs to edit A's file at all.

## 6. Risks and open questions for the owner

**Risks**

1. **CI without a test framework only catches type errors and build failures, not logic regressions.** Per owner decision (2026-10-22), Phase 1 adds CI (`tsc` + `build`) but no Vitest/Playwright. This means CI will not catch: a broken ownership check (wrong `userId` filter leaking another user's data — the exact class of bug `CLAUDE.md`'s "Key Patterns" section exists to prevent), a status-history write that silently fails to fire, an auth-gate regression, or a Gmail token that fails to decrypt. These are precisely the areas Phase 2's four parallel agents will be touching. Mitigation without a test suite: enforce manual verification steps in each Phase 2 PR description (e.g. "created an application with zero contacts and confirmed it rendered," "revoked a token and confirmed `getUserIdFromBearerToken` returns null") — flagging this now per your request to be alerted to concerns from this decision, not objecting to the decision itself.
2. **Migrating a live, real-data Postgres database.** Today's `Entry.userId`/`Resume.userId` went from nullable to required in two separate migrations — plan for the same two-step pattern anywhere a new required column lands on a table that might already have rows by the time it ships (e.g. `Application.source`/`externalId` for the importer).
3. **Gmail incremental auth is the least-proven part of this plan.** Nothing in the current codebase exercises offline-access/refresh-token handling or scope expansion — Phase 1's OAuth skeleton (task 7) should be built and manually verified (token survives a server restart, refresh actually refreshes) before Module C is allowed to build sync logic on top of it.
4. ~~Auth posture mismatch~~ **Resolved**: one whole-app gate, built once in Phase 1, so no Phase 2 module can accidentally ship a different posture (§1.2).
5. **PLAN.md §6 Phase 4 calls for "end-to-end tests for the main flows"** as part of hardening/release — with no test framework adopted in Phase 1, that line item either needs Playwright introduced then (later and under more time pressure, since it's the last phase before release) or needs to be dropped/replaced with a manual release checklist. Worth a decision before Phase 4 arrives rather than at Phase 4 itself.
6. **Gmail connection is opt-in, not required** — confirmed as the intended design (owner, 2026-10-22): `GmailAccount` has no required FK from `User` and no other table requires a `GmailAccount` row to exist, so a user who never clicks "Connect Gmail" is fully unaffected — Applications/Contacts/Interactions all work with `email_thread_id`/`GmailAccount` absent, same as the existing "applications work with no contacts" principle.

**Open questions**

1. ~~Should the owner-allowlist auth gate apply only to tracker routes or retroactively too?~~ **Resolved**: whole app, one gate (§1.2).
2. ~~For the Gmail OAuth client...~~ **Resolved**: same `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` client, new redirect URI + separate code path (§1.1). Still open: confirm whether the Google Cloud project is in "Testing" publishing status (fine for a single allowlisted user, avoids full app verification) or "Production" (would trigger Google's sensitive-scope review for `gmail.readonly`).
3. ~~`FUTURE_FEATURES.md`...~~ **Resolved**: deletion is intentional (confirmed by owner 2026-10-22).
4. Confirm final `Application` status list and company "tier" definitions against the current Notion tracker, so the Phase 3 importer's mapping step has a fixed target instead of guessing.
