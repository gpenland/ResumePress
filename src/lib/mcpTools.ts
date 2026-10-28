import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listCategoriesForUser } from "@/lib/categories";
import {
  createEntryForUser,
  getEntryForUser,
  listEntriesForUser,
} from "@/lib/entries";
import {
  createResumeForUser,
  getResumeForUser,
  listResumesForUser,
  buildSnapshotSections,
  snapshotSectionsToEntriesByCategory,
} from "@/lib/resumes";
import { compileResumeSchema, entryCoreFieldsSchema, identitySchema } from "@/lib/schemas/resumeEntry";
import { compileResumeToPdf, type EntriesByCategory } from "@/lib/resumeCompiler";
import { textResult, errorResult, compact } from "@/lib/mcp/shared";
import { registerEntryManagementTools } from "@/lib/mcp/entryTools";
import { registerResumeManagementTools } from "@/lib/mcp/resumeTools";
import { registerCompanyApplicationTools } from "@/lib/mcp/applicationTools";
import { registerContactTools } from "@/lib/mcp/contactTools";
import { registerInteractionTools } from "@/lib/mcp/interactionTools";
import { registerEmailTools } from "@/lib/mcp/emailTools";
import { registerSearchTools } from "@/lib/mcp/searchTools";

// Strips the **bold**/*italic* markers bullets/descriptions are stored with
// (see CLAUDE.md "Rich text in bullets/descriptions") down to plain text —
// export_resume_text has no LaTeX/HTML target to render them into.
function stripFormatting(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
}

function renderResumeAsText(identity: Record<string, string | undefined>, sections: EntriesByCategory): string {
  const lines: string[] = [];
  if (identity.name) lines.push(identity.name);
  const contactLine = [identity.email, identity.phone, identity.website, identity.linkedin, identity.github]
    .filter(Boolean)
    .join(" | ");
  if (contactLine) lines.push(contactLine);

  for (const section of sections) {
    if (section.entries.length === 0) continue;
    lines.push("", section.category.name.toUpperCase());
    for (const entry of section.entries) {
      const header = [entry.title, entry.organization].filter(Boolean).join(" — ");
      const dates = [entry.startDate, entry.endDate].filter(Boolean).join(" – ");
      const meta = [entry.location, dates].filter(Boolean).join(" | ");
      lines.push(meta ? `${header} (${meta})` : header);
      if (entry.description) lines.push(stripFormatting(entry.description));
      for (const bullet of entry.bullets) lines.push(`- ${stripFormatting(bullet)}`);
    }
  }
  return lines.join("\n");
}

export function registerResumePressTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_categories",
    {
      description: "List all categories (built-in and custom) available to this user.",
      inputSchema: {},
    },
    async () => textResult(compact(await listCategoriesForUser(userId)))
  );

  server.registerTool(
    "list_entries",
    {
      description:
        "List this user's entries, optionally filtered by category or tag. Returns a compact summary " +
        "(id, title, displayTitle, organization, location, dates, tags, categoryId) by default — pass " +
        "full: true for complete fields including bullets/description/url, or use get_entry for one entry's full detail.",
      inputSchema: {
        categoryId: z.string().optional(),
        tag: z.string().optional(),
        full: z.boolean().optional(),
      },
    },
    async ({ categoryId, tag, full }) => {
      const entries = await listEntriesForUser(userId, { categoryId, tag });
      if (full) return textResult(compact(entries));
      return textResult(
        compact(
          entries.map((e) => ({
            id: e.id,
            title: e.title,
            displayTitle: e.displayTitle,
            organization: e.organization,
            location: e.location,
            startDate: e.startDate,
            endDate: e.endDate,
            tags: e.tags,
            categoryId: e.categoryId,
          }))
        )
      );
    }
  );

  server.registerTool(
    "get_entry",
    {
      description: "Get a single entry by id, with full fields (bullets, description, url, tags, etc).",
      inputSchema: {
        entryId: z.string(),
      },
    },
    async ({ entryId }) => {
      const entry = await getEntryForUser(userId, entryId);
      if (!entry) return errorResult(`Entry ${entryId} not found`);
      return textResult(compact(entry));
    }
  );

  server.registerTool(
    "list_resumes",
    {
      description:
        "List this user's resumes as a compact summary (id, name, templateId, updatedAt, entryCount) — use " +
        "get_resume for one resume's full identity block and ordered entries.",
      inputSchema: {},
    },
    async () =>
      textResult(
        compact(
          (await listResumesForUser(userId)).map((r) => ({
            id: r.id,
            name: r.name,
            templateId: r.templateId,
            updatedAt: r.updatedAt,
            entryCount: r._count.entries,
          }))
        )
      )
  );

  server.registerTool(
    "get_resume",
    {
      description: "Get a resume by id, including its full identity block and ordered entries.",
      inputSchema: {
        resumeId: z.string(),
      },
    },
    async ({ resumeId }) => {
      const resume = await getResumeForUser(userId, resumeId);
      if (!resume) return errorResult(`Resume ${resumeId} not found`);
      return textResult(compact(resume));
    }
  );

  server.registerTool(
    "export_resume_text",
    {
      description:
        "Export a resume's identity + entries as plain text (not PDF/LaTeX) — handy for pasting into a cover " +
        "letter, or as context when tailoring/advising without the token cost of a full PDF round-trip.",
      inputSchema: { resumeId: z.string() },
    },
    async ({ resumeId }) => {
      const resume = await getResumeForUser(userId, resumeId);
      if (!resume) return errorResult(`Resume ${resumeId} not found`);

      const identity = (resume.identity ?? {}) as Record<string, string | undefined>;
      const sections = snapshotSectionsToEntriesByCategory(buildSnapshotSections(resume));
      return textResult({ text: renderResumeAsText(identity, sections) });
    }
  );

  server.registerTool(
    "create_entry",
    {
      description:
        "Create a new entry (work experience, education, project, skill, etc.) for this user.",
      // Reuses entryCoreFieldsSchema's length caps (the same ones compile_resume
      // enforces) instead of bare z.string() — found missing by the Phase 4 audit,
      // since this path (unlike compile_resume) is DB-backed, not discard-after-use.
      inputSchema: {
        ...entryCoreFieldsSchema.shape,
        categoryId: z.string().min(1).max(100),
        displayTitle: z.string().max(200).optional(),
      },
    },
    async (data) => {
      const result = await createEntryForUser(userId, data);
      if (!result.ok) return errorResult(result.error);
      return textResult(compact(result.entry));
    }
  );

  server.registerTool(
    "create_resume",
    {
      description: "Create a new resume for this user.",
      inputSchema: {
        name: z.string().min(1).max(200),
        templateId: z.string().max(50).optional(),
        identity: z.object(identitySchema.shape),
      },
    },
    async (data) => textResult(compact(await createResumeForUser(userId, data)))
  );

  server.registerTool(
    "compile_resume",
    {
      description:
        "Compile a resume to PDF from inline identity + entries, without saving anything to the database. " +
        "Returns the PDF as a base64-encoded blob resource. Nothing about this call is persisted.",
      inputSchema: compileResumeSchema.shape,
    },
    async ({ templateId, identity, sections }) => {
      const entriesByCategory: EntriesByCategory = sections.map((section) => ({
        category: { slug: section.categorySlug, name: section.categoryName },
        entries: section.entries.map((entry) => ({
          ...entry,
          bullets: entry.bullets ?? [],
          tags: entry.tags ?? [],
        })),
      }));

      try {
        const pdfBuffer = await compileResumeToPdf(templateId, identity, entriesByCategory);
        return {
          content: [
            {
              type: "resource" as const,
              resource: {
                uri: "data:application/pdf;name=resume.pdf",
                mimeType: "application/pdf",
                blob: pdfBuffer.toString("base64"),
              },
            },
          ],
        };
      } catch (err) {
        return errorResult(
          `PDF compilation failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  );

  registerEntryManagementTools(server, userId);
  registerResumeManagementTools(server, userId);
  registerCompanyApplicationTools(server, userId);
  registerContactTools(server, userId);
  registerInteractionTools(server, userId);
  registerEmailTools(server, userId);
  registerSearchTools(server, userId);
}
