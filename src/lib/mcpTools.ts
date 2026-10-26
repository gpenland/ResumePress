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
} from "@/lib/resumes";
import { compileResumeSchema, entryCoreFieldsSchema, identitySchema } from "@/lib/schemas/resumeEntry";
import { compileResumeToPdf, type EntriesByCategory } from "@/lib/resumeCompiler";
import { textResult, errorResult } from "@/lib/mcp/shared";
import { registerEntryManagementTools } from "@/lib/mcp/entryTools";
import { registerResumeManagementTools } from "@/lib/mcp/resumeTools";
import { registerCompanyApplicationTools } from "@/lib/mcp/applicationTools";
import { registerContactTools } from "@/lib/mcp/contactTools";
import { registerInteractionTools } from "@/lib/mcp/interactionTools";
import { registerEmailTools } from "@/lib/mcp/emailTools";
import { registerSearchTools } from "@/lib/mcp/searchTools";

export function registerResumePressTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_categories",
    {
      description: "List all categories (built-in and custom) available to this user.",
      inputSchema: {},
    },
    async () => textResult(await listCategoriesForUser(userId))
  );

  server.registerTool(
    "list_entries",
    {
      description: "List this user's entries, optionally filtered by category.",
      inputSchema: {
        categoryId: z.string().optional(),
      },
    },
    async ({ categoryId }) =>
      textResult(await listEntriesForUser(userId, { categoryId }))
  );

  server.registerTool(
    "get_entry",
    {
      description: "Get a single entry by id.",
      inputSchema: {
        entryId: z.string(),
      },
    },
    async ({ entryId }) => {
      const entry = await getEntryForUser(userId, entryId);
      if (!entry) return errorResult(`Entry ${entryId} not found`);
      return textResult(entry);
    }
  );

  server.registerTool(
    "list_resumes",
    {
      description: "List this user's resumes.",
      inputSchema: {},
    },
    async () => textResult(await listResumesForUser(userId))
  );

  server.registerTool(
    "get_resume",
    {
      description: "Get a resume by id, including its ordered entries.",
      inputSchema: {
        resumeId: z.string(),
      },
    },
    async ({ resumeId }) => {
      const resume = await getResumeForUser(userId, resumeId);
      if (!resume) return errorResult(`Resume ${resumeId} not found`);
      return textResult(resume);
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
      return textResult(result.entry);
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
    async (data) => textResult(await createResumeForUser(userId, data))
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
