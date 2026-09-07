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

## MCP / Claude Desktop Integration — Shipped
- **Remote MCP server** at `POST /api/mcp` (`src/app/api/mcp/route.ts`), using `@modelcontextprotocol/sdk`'s stateless Streamable HTTP transport. Auth is a new bearer-token model (`ApiToken` Prisma model, hashed with SHA-256, never stored in plaintext), fully separate from NextAuth's cookie-based sessions. Tokens are issued/revoked at `/settings/tokens`.
- Tool scope is **read + create only** (no update/delete): `list_categories`, `list_entries`, `get_entry`, `list_resumes`, `get_resume`, `create_entry`, `create_resume` — see `src/lib/mcpTools.ts`. Lower blast radius from a bad/manipulated tool call, since there's no entry/resume version history yet for undo.
- Shared DB logic lives in `src/lib/entries.ts`, `src/lib/resumes.ts`, `src/lib/categories.ts` as plain `*ForUser(userId, ...)` functions, called by both the MCP tools and the existing `"use server"` actions (which still own their own `requireUserId()`/`redirect()`/`revalidatePath()` handling).
- **Connecting Claude:** create a token at `/settings/tokens`, then in Claude add a custom connector with URL `https://<your-domain>/api/mcp`, **Authentication: None**, and a **Request header** `Authorization` = `Bearer <token>` (marked Required). This uses Claude's `static_headers` request-header auth (currently in beta, gated per-organization) rather than full OAuth — avoids standing up an OAuth authorization server (DCR/CIMD) for what's a personal single-user integration.
- Follow-up ideas: update/delete tools once entry/resume versioning exists for recoverability; token expiry reminders; per-token tool scoping.

## Integrations
- **LinkedIn sync** — pull work history and projects from a LinkedIn profile URL
- **GitHub sync** — auto-generate project entries from pinned GitHub repos (name, description, languages as tags)
- **Google Drive / Dropbox export** — push compiled PDFs directly to cloud storage
- **Webhook on compile** — trigger an external URL when a new PDF is compiled (for automation workflows)
