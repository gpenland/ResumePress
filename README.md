# ResumePress

ResumePress is a resume builder: keep a library of reusable experience/education/project/skill entries, assemble them into resumes, and export a polished PDF rendered with LaTeX (Jake Gutierrez's popular resume template).

- **Entries** — durable, reusable content (jobs, degrees, projects, skills) organized by category.
- **Resumes** — pick a subset of entries, order them, and set an identity block (name, email, phone, links).
- **PDF export** — `GET /api/pdf/[resumeId]` renders the selected entries to a `.tex` file and compiles it with `pdflatex`.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Prisma 5 + PostgreSQL · shadcn/ui (base-ui variant) · Auth.js v5 (Google OAuth)

## Prerequisites

- Node.js and npm
- PostgreSQL running locally (or via Docker, see below)
- `pdflatex` installed locally — `brew install --cask mactex-no-gui` on macOS (not needed if you only run via Docker, which bundles TeX Live)
- A Google Cloud OAuth 2.0 **Web application** client, with an authorized redirect URI of `http://localhost:3000/api/auth/callback/google` for local dev

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

Set `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` via a `.env` file or your environment before starting.

## Architecture & contributing

See [`CLAUDE.md`](./CLAUDE.md) for a deeper dive into the architecture, data model, and codebase conventions (ownership checks, server actions, the LaTeX template, etc.), and [`CONTRIBUTING.md`](./CONTRIBUTING.md) for how to submit changes.

## License

[MIT](./LICENSE)
