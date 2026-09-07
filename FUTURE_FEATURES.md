# ResumePress — Future Features

## AI & Analysis
- **Job description upload + keyword analysis** — paste or upload a JD, automatically highlight which of your stored entries are most relevant, and suggest bullet points or rewordings that better match the posting's language
- **ATS score estimate** — analyze a compiled resume against a JD and surface missing keywords or formatting issues that ATS parsers commonly reject
- **Bullet point suggestions** — AI-assisted rewording of bullets to use stronger action verbs or quantify impact
- **Auto-tagging** — infer tags on entries from title/description using a language model

## Resume Configuration & Compilation
- **Saved compilation settings** — per-resume settings for paper size, font size, margin widths, color accent, and line spacing, stored alongside the resume record
- **Compilation profiles** — named presets (e.g. "tight one-pager", "spacious two-page") that bundle compilation settings and can be swapped without rebuilding
- **One-click re-compile** — re-generate PDF after any entry or setting change without leaving the builder
- **PDF version history** — store past compiled PDFs so you can revert or compare versions

## Templates
- **Custom template upload** — upload a `.tex` file as a new template
- **Field mapping UI** — after uploading, interactively map LaTeX placeholder tokens to ResumePress data fields (title, organization, bullets, etc.)
- **Template preview** — see a rendered sample PDF before assigning a template to a resume
- **Section reordering per template** — define which categories map to which template sections and in what order
- **Multiple templates per resume** — generate the same entry set in different templates in one click (e.g., a creative template for design jobs, a classic one for finance)

## Entry Management
- **Bulk import** — import entries from LinkedIn export, JSON, or CSV
- **Entry versioning** — track edits to entries over time; revert to a prior version
- **Entry cloning** — duplicate an entry to create a variant (e.g., same job, different bullet emphasis)
- **Rich text bullets** — support bold, italic, and inline code in bullet points that survive LaTeX escaping
- **Entry expiration / archiving** — mark old entries as archived so they're hidden from the builder by default but still searchable

## Resume Builder
- **Drag-and-drop section reordering** — reorder entire category sections in the builder, not just individual entries
- **Per-resume entry customization** — override a bullet or title for a specific resume without changing the source entry
- **Cover letter builder** — companion editor for a plain-text or LaTeX cover letter, compiled alongside the resume
- **Side-by-side PDF preview** — live-rendered PDF preview panel in the builder (using PDF.js)
- **Share link** — generate a read-only link to a compiled resume PDF (useful for recruiters)

## User & Multi-user
- **Auth / accounts** — NextAuth.js integration so multiple users can each have their own entry library (also unblocks the "Claude Desktop MCP server" idea under Integrations, and any other API/MCP exposure of this data)
- **Team / organization mode** — shared entry library for a team, with per-member resume customization
- **Resume feedback requests** — share a draft resume and invite collaborators to leave inline comments

## MCP / Claude Desktop Integration
- **Claude Desktop MCP server** — expose ResumePress to Claude Desktop via MCP so it can read all entries for context and create new entries/resumes. **Blocked on system-wide auth** (see "Auth / accounts" below) — the app currently has zero authentication/authorization: no `User` model, no `middleware.ts`, no session library, and no ownership field on `Entry`/`Resume`/`Category`/`ResumeEntry`, so every record is globally readable/writable by anyone who knows its id. Bolting auth onto just an MCP endpoint would leave the rest of the app (server actions, PDF route) unprotected, so this should be designed as part of the broader auth rollout, not before it.
  - Transport options to revisit once auth is decided:
    - *Local stdio* — Claude Desktop spawns a local Node script (MCP SDK stdio transport) talking directly to the local Postgres via Prisma. No network exposure, trust boundary is the OS; simplest, but only works on the machine running it and against whatever DB its `.env` points at.
    - *Remote HTTP on Sevalla* — a `/api/mcp` route using MCP's Streamable HTTP transport, reachable from anywhere. Needs real authentication (e.g. bearer token) since the app has none today.
  - Tool scope to decide alongside auth: read + create only (lower blast radius) vs. full CRUD (more powerful, more risk from a bad or manipulated tool call).
  - Injection/safety note: main risk isn't cross-user leakage (single-tenant today) but an unsupervised MCP write tool corrupting resume data with no undo. Pair any future write tools with the "Entry versioning" / "PDF version history" ideas above for recoverability.
  - Implementation notes: `@modelcontextprotocol/sdk` is currently only a transitive dependency (via shadcn tooling) — would need to be added directly. Follow the existing `src/app/api/pdf/[resumeId]/route.ts` pattern for any HTTP-based route (import `prisma` from `@/lib/prisma`, await async `params`, `NextResponse.json` with explicit status codes).

## Integrations
- **LinkedIn sync** — pull work history and projects from a LinkedIn profile URL
- **GitHub sync** — auto-generate project entries from pinned GitHub repos (name, description, languages as tags)
- **Google Drive / Dropbox export** — push compiled PDFs directly to cloud storage
- **Webhook on compile** — trigger an external URL when a new PDF is compiled (for automation workflows)
