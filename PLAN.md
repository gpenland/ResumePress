# Project Plan: ResumePress + Applications CRM (unified app)

Working title: ResumePress (unified). One app, one database, one login, deployed from day one.

## 1. Goal

Merge the existing ResumePress (resume entries, categories, reusable fields, manual selection, LaTeX compile to PDF) with a new job-search tracker:

- **Applications**: track every internship application, its status, dates, and notes. Fully usable on its own, with no contacts required.
- **Contacts (recruiters and others)**: tracked independently of any application (e.g. someone met at a career fair), with a LinkedIn link and a full history of every interaction.
- **Interactions**: a timeline of every touchpoint (email, call, meeting, career fair, LinkedIn message), linkable to a contact, an application, or both.
- **Gmail (read-only)**: sync threads from a chosen Gmail label and attach them to contacts and applications.
- **Resume link**: each application records which resume version was sent.

The app replaces a Notion-based tracker. Spreadsheet-style editing is the primary interaction model.

## 2. Principles

1. **Applications work without contacts.** Every contact/interaction foreign key on an application is nullable. No screen in the Applications module may require a contact.
2. **Migrate, don't rewrite.** Preserve existing ResumePress behavior and data. Change its stack only if discovery shows it is blocking (decide in Phase 0, with the user).
3. **Spreadsheet-first UI.** Inline editing, keyboard navigation, sort, filter, group, saved views, column visibility, bulk edit, CSV import and export.
4. **Gmail is read-only.** Never send, modify, label, or delete anything in Gmail. Request only the `gmail.readonly` scope.
5. **Single user, private by default.** Allowlist the owner's Google account. Every route and API handler checks auth.
6. **Never delete files.** Edit existing files only when the change is part of the plan. Prefer additive migrations.
7. **Small, reviewable commits** on feature branches. Tests alongside features.

## 3. Data model (target; reconcile with the existing ResumePress schema in Phase 0)

**Existing (ResumePress)**: categories, entries (with tags and bullets), resumes, resume-to-entry selection, LaTeX compile. Phase 0 documents the real schema and maps it here.

**New**

| Table | Key fields |
|---|---|
| `companies` | name, website, tier (target-list priority), notes |
| `applications` | company_id, role_title, term/season (e.g. Summer 2027), status, applied_at, deadline, posting_url, location, source, priority, resume_id (nullable), next_follow_up_at, notes (markdown) |
| `application_status_history` | application_id, from_status, to_status, changed_at (written automatically on every status change) |
| `contacts` | name, company_id (nullable), title, emails[], linkedin_url, phone (optional), how_met (career fair, referral, cold outreach, event name), met_at, notes (markdown), tags, next_follow_up_at |
| `application_contacts` | application_id, contact_id, role (recruiter, referrer, hiring manager, other) |
| `interactions` | type (email, call, meeting, career_fair, coffee_chat, linkedin, other), occurred_at, summary, contact_id (nullable), application_id (nullable), email_thread_id (nullable) |
| `email_threads` | gmail_thread_id, subject, snippet, participants[], last_message_at, gmail_url, matched_contact_id, matched_application_id, match_status (auto, confirmed, unmatched, ignored) |
| `oauth_accounts` | encrypted refresh token, scopes, last_sync_at, history_id |

Suggested application statuses: Wishlist, Preparing, Applied, OA/Screen, Interviewing, Offer, Accepted, Rejected, Withdrawn, Ghosted. Keep statuses configurable.

## 4. Features for v1

**Applications module**
- Editable grid with the interactions above, plus saved views (e.g. "Active", "Needs follow-up", "By tier").
- Kanban board grouped by status, with drag to change status.
- Detail page: markdown notes, status history, linked contacts, interaction timeline, attached email threads, resume used.
- CSV import and export.
- One-time importer for the existing Notion tracker (CSV export). Include a mapping step and a dry-run preview.

**Contacts module**
- Grid of all contacts with filters (company, how met, last contacted, follow-up due).
- Detail page: LinkedIn link, notes, applications they are tied to, full interaction timeline.
- "Log interaction" quick-add available everywhere (keyboard shortcut and button).
- Contacts can exist with no application at all.

**Gmail sync (read-only)**
- Sign in with Google via Auth.js; request `gmail.readonly` only.
- User picks one or more labels to sync. Manual "Sync now" plus a scheduled incremental sync (use Gmail `historyId`).
- Matching: participant email to contact (exact); sender domain or company name to a suggested application. Auto-link only on exact contact-email matches. Everything else goes to a **triage queue** where the user confirms, reassigns, or ignores.
- Store metadata and snippet only (subject, participants, dates, snippet, link back to Gmail). Do not store full message bodies unless the user later opts in.
- Encrypt refresh tokens at rest. Handle token expiry and revocation gracefully.

**Resume integration**
- Application has a resume picker. "Open resume" and "Recompile" from the application page.
- Existing ResumePress builder remains a first-class section of the app.

**Cross-cutting**
- Follow-up dashboard: applications and contacts with `next_follow_up_at` due or overdue.
- Global search across applications, contacts, interactions, and notes.

## 5. Tech decisions

Defaults (override in Phase 0 if the existing ResumePress stack argues otherwise):

- Next.js (App Router) + TypeScript
- Postgres (Neon or Supabase) with Drizzle ORM and versioned migrations
- Auth.js with Google provider
- TanStack Table for grids (move to AG Grid Community or Glide Data Grid only if copy/paste ranges or heavy keyboard navigation are needed)
- shadcn/ui + Tailwind, Zod for validation
- Vitest for unit tests, Playwright for end-to-end
- CI on GitHub Actions

**Key risk: LaTeX compilation.** ResumePress compiles resumes to PDF with LaTeX. Serverless hosts (e.g. Vercel) generally cannot run a full TeX install. Phase 0 must establish exactly how compilation works today and recommend one of:
1. Host the whole app on a Docker-capable platform (Railway, Fly.io, or Sevalla) with TeX included in the image.
2. Host the app serverless and run compilation as a separate containerized service.
3. Switch to a lighter compile approach (e.g. Tectonic) if it produces the same output.

This choice drives the hosting decision, so it is a Phase 0 deliverable.

## 6. Phases

**Phase 0: Discovery (read-only, single agent). STOP for user review afterward.**
- Read the ResumePress repo: stack, schema, auth, compile pipeline, deploy setup, tests, tech debt.
- Write `docs/DISCOVERY.md` (what exists) and `docs/MIGRATION_PLAN.md` (unified schema, stack decision, hosting decision, risks, step order).
- Make no code changes outside `docs/`.

**Phase 1: Foundation (single agent). STOP for user review afterward.**
- Branch, CI, environment config, secrets handling.
- Unified schema and migrations (additive; existing data intact).
- Auth with owner allowlist; protected route layout; app shell with navigation.
- Deploy skeleton to production host with a working health check and database.

**Phase 2: Feature modules (parallel agents, each in its own git worktree, each owning its own directory)**
- **A. Applications**: grid, kanban, detail page, status history, CSV import/export.
- **B. Contacts and Interactions**: grids, detail pages, quick-add, follow-up fields.
- **C. Gmail sync**: OAuth, label selection, incremental sync, matching, triage queue.
- **D. Resume integration**: resume picker, open/recompile from application.

Rules: schema changes go through the Phase 1 migration process only (small additive migrations, reviewed before merge). Shared UI components live in a shared directory owned by the foundation agent; module agents request additions instead of forking them.

**Phase 3: Integration**
- Notion CSV importer with dry-run preview.
- Cross-linking UI (timeline everywhere, contacts on applications and vice versa).
- Follow-up dashboard and global search.

**Phase 4: Hardening and release**
- Independent review agent (has not seen the implementation work) audits: auth on every route, OAuth scope and token storage, input validation, SQL and XSS exposure, error handling, accessibility basics.
- End-to-end tests for the main flows.
- Production deploy, backups, README and short runbook.

## 7. Acceptance criteria

- Applications can be created, edited inline, filtered, grouped, and moved between statuses with no contacts in the system.
- A contact can be created with no application and shows a complete interaction timeline.
- Syncing a labeled Gmail thread from a known contact attaches it automatically; an unknown sender lands in the triage queue.
- The app never requests more than `gmail.readonly` and never modifies Gmail.
- An application records its resume, and the resume can be opened or recompiled from it.
- Existing ResumePress entries and resumes are intact and compile as before.
- Notion tracker data imports with a preview step.
- Deployed to production behind Google sign-in restricted to the owner.
- CI green; main flows covered by end-to-end tests.

## 8. Out of scope for v1

Sending or drafting email, public-facing pages, multi-user or team features, mobile app, AI-based email classification or auto-tailoring (good candidates for v2).

## 9. Open questions for the owner (resolve in or after Phase 0)

1. Where does the ResumePress code live (repo or folder), and what is its stack?
2. Preferred hosting platform once the LaTeX question is answered.
3. Gmail label name(s) to sync, and whether any contacts should be pre-seeded.
4. Final status list and tier definitions to match the current Notion setup.
