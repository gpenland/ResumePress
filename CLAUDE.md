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

Postgres must be running for `dev` and `db:*` commands. `.env` needs `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/resumepress?schema=public`.

## Architecture

**Stack:** Next.js 16 App Router · TypeScript · Tailwind CSS v4 · Prisma 5 + PostgreSQL · shadcn/ui (base-ui variant)

**PDF generation:** `GET /api/pdf/[resumeId]` fetches the resume + selected entries from the DB, calls `src/templates/jake.ts` to render a `.tex` string, writes it to a temp dir, runs `pdflatex` twice, and streams back the PDF. pdflatex must be installed locally (`brew install --cask mactex-no-gui`) or is included in the Docker image via `apt-get install texlive-*`.

**Deployment:** Docker + Sevalla. `docker-entrypoint.sh` runs `prisma migrate deploy`, seeds categories, then `node server.js`. `next.config.ts` uses `output: "standalone"`.

## Key Patterns

**Server Actions** are the mutation layer — every create/update/delete is a `"use server"` function in an `actions.ts` file colocated with its route. Pages are async RSC that fetch directly via `prisma`; all data-fetching pages export `dynamic = "force-dynamic"`.

**shadcn/ui here uses `@base-ui/react`**, not Radix UI. Important differences:
- `Button` has no `asChild` prop — use `buttonVariants` on a `<Link>` instead: `<Link className={cn(buttonVariants({ variant: "outline" }))}>`
- `Select.Value` renders the raw value string, not the selected item's label — render the label manually in the trigger
- `Checkbox` renders as `<button>`, not `<input>` — native `<label>` won't forward clicks to it; use a `<div onClick>` with `pointer-events-none` on the Checkbox
- `AlertDialog` does not use a Trigger in this codebase — manage `open` state manually

**Rich text in bullets/descriptions** is stored as plain strings with `**bold**` and `*italic*` markers. `applyFormatting()` in `src/templates/jake.ts` converts these to `\textbf{}` / `\textit{}` after LaTeX-escaping. The preview parses them to `<strong>` / `<em>` in `EntryForm.tsx`.

**Entry field visibility** is driven by `src/lib/entryFields.ts`. `FIELD_CONFIGS` maps category slugs to `FieldConfig` objects that control which fields render in `EntryForm`. Add a new built-in category type by adding an entry to `FIELD_CONFIGS`; custom categories fall back to `DEFAULT_FIELD_CONFIG` (all fields).

**LaTeX template** lives entirely in `src/templates/jake.ts`. `escapeLatex` → `applyFormatting` → template string. Education uses `\resumeSubheading{school}{location}{degree}{date}` (location is arg #2, date is arg #4) — this differs from Experience where date is arg #2.

**Card spacing gotcha:** The shadcn Card applies `py-(--card-spacing)` (16px) to itself plus `gap-(--card-spacing)` between children. For list-row cards that use `CardContent` with its own `py-*`, add `py-0` to the `Card` to avoid double-stacking vertical padding.

## Data Model

```
Category  id, name, slug, isBuiltIn
Entry     id, title, organization?, location?, startDate?, endDate?,
          description?, bullets[], url?, tags[], categoryId
Resume    id, name, templateId ("jake"), identity (JSON), entries[]
ResumeEntry  resumeId, entryId, order  ← join table; order controls PDF ordering
```

`identity` JSON shape: `{ name, email, phone, website, linkedin, github }`.

Built-in category slugs: `experience`, `education`, `projects`, `skills`. These slugs are matched in `renderSection()` in `jake.ts` to determine which LaTeX render function to call.

## Adding a New Template

1. Create `src/templates/<name>.ts` exporting a `render(identity, entriesByCategory)` function with the same signature as `jake.ts`.
2. Register it in `TEMPLATE_RENDERERS` in `src/app/api/pdf/[resumeId]/route.ts`.
3. Add it to the `TEMPLATES` array in `src/app/resumes/new/page.tsx`.
