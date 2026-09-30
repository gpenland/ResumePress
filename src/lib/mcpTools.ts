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
import { compileResumeSchema } from "@/lib/schemas/resumeEntry";
import { compileResumeToPdf, type EntriesByCategory } from "@/lib/resumeCompiler";

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  };
}

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
      inputSchema: {
        title: z.string(),
        categoryId: z.string(),
        displayTitle: z.string().optional(),
        organization: z.string().optional(),
        location: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        description: z.string().optional(),
        url: z.string().optional(),
        bullets: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
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
        name: z.string(),
        templateId: z.string().optional(),
        identity: z.object({
          name: z.string(),
          email: z.string(),
          phone: z.string().optional(),
          website: z.string().optional(),
          linkedin: z.string().optional(),
          github: z.string().optional(),
        }),
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
}
