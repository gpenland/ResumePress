# ResumePress

ResumePress started as a resume builder and has grown into a combined resume builder + job-application tracker.

**Resume builder:**

- **Entries** — durable, reusable content (jobs, degrees, projects, skills) organized by category.
- **Resumes** — pick a subset of entries, order them, and set an identity block (name, email, phone, links).
- **PDF export** — `GET /api/pdf/[resumeId]` renders the selected entries to a `.tex` file and compiles it with `pdflatex`.

**Job-application tracker:**

- **Applications** — a grid/kanban tracker (company, role, status, dates), with automatic status history and a one-time CSV/Notion importer.
- **Contacts & Interactions** — recruiters and other contacts, independent of any application, with a logged timeline of every email/call/meeting.
- **Gmail sync** (read-only, optional) — connect Gmail, sync a chosen label, and matched email threads attach themselves to the right contact or application. Unmatched threads land in a triage queue (`/triage`) for manual review.
- **Resume integration** — attach a resume to an application and open/recompile its PDF directly from there.
- **Dashboard & search** — the home page (`/`) surfaces contacts due for follow-up and pending Gmail triage; `/search` searches across applications, contacts, and interactions.

See [`PLAN.md`](./PLAN.md) for the original tracker spec and [`docs/MIGRATION_PLAN.md`](./docs/MIGRATION_PLAN.md) for the architecture decisions made while building it.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Prisma 5 + PostgreSQL · shadcn/ui (base-ui variant) · Auth.js v5 (Google OAuth)

## Prerequisites

- Node.js and npm
- PostgreSQL running locally (or via Docker, see below)
- `pdflatex` installed locally — `brew install --cask mactex-no-gui` on macOS (not needed if you only run via Docker, which bundles TeX Live)
- A Google Cloud OAuth 2.0 **Web application** client, with authorized redirect URIs for:
  - Sign-in: `http://localhost:3000/api/auth/callback/google` (local) and `<production-origin>/api/auth/callback/google`
  - Gmail connect (separate flow, same client — see `docs/MIGRATION_PLAN.md` §1.1): `http://localhost:3000/api/gmail/oauth/callback` and `<production-origin>/api/gmail/oauth/callback`, plus the `gmail.readonly` scope added to the OAuth consent screen

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/resumepress?schema=public"
AUTH_SECRET=""      # generate with: npx auth secret
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
ALLOWED_EMAILS=""   # comma-separated list of Google account emails allowed to sign in
GMAIL_TOKEN_ENCRYPTION_KEY=""   # generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Then, with Postgres running:

```bash
npm run db:migrate   # apply Prisma migrations
npm run db:seed      # seed built-in categories (experience, education, projects, skills)
npm run dev           # start the dev server at http://localhost:3000
```

## Other useful commands

```bash
npm run build         # production build
npx tsc --noEmit      # type-check without building
npm run db:studio     # open Prisma Studio
```

## Running with Docker

`docker-compose.yml` brings up Postgres and the app together (the app image includes TeX Live, so `pdflatex` doesn't need to be installed on the host):

```bash
docker compose up
```

Set all six variables listed above (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAILS`, `GMAIL_TOKEN_ENCRYPTION_KEY`) via a `.env` file or your environment before starting.

## Architecture & contributing

See [`CLAUDE.md`](./CLAUDE.md) for a deeper dive into the architecture, data model, and codebase conventions (ownership checks, server actions, the LaTeX template, etc.), [`CONTRIBUTING.md`](./CONTRIBUTING.md) for how to submit changes, and [`RUNBOOK.md`](./RUNBOOK.md) for operating the production deployment (deploys, rollbacks, backups, Gmail reconnects).

## License

[MIT](./LICENSE)
