import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createEntryForUser,
  getEntryForUser,
  updateEntryForUser,
  listEntryVersionsForUser,
} from "@/lib/entries";
import { entryCoreFieldsSchema } from "@/lib/schemas/resumeEntry";
import { textResult, errorResult } from "./shared";

/** Entry mutations/reads beyond the original create_entry/get_entry/list_entries, plus category management. */
export function registerEntryManagementTools(server: McpServer, userId: string): void {
  server.registerTool(
    "update_entry",
    {
      description:
        "Update an existing entry's fields. Snapshots the entry's prior values into its edit history unless the edit is a no-op.",
      inputSchema: {
        entryId: z.string(),
        ...entryCoreFieldsSchema.shape,
        categoryId: z.string().min(1).max(100),
        displayTitle: z.string().max(200).optional(),
      },
    },
    async ({ entryId, ...data }) => {
      const result = await updateEntryForUser(userId, entryId, data);
      if (!result.ok) return errorResult(`Entry ${entryId} not found`);
      return textResult(result);
    }
  );

  server.registerTool(
    "delete_entry",
    {
      description: "Delete an entry.",
      inputSchema: { entryId: z.string() },
    },
    async ({ entryId }) => {
      const { count } = await prisma.entry.deleteMany({ where: { id: entryId, userId } });
      if (count === 0) return errorResult(`Entry ${entryId} not found`);
      return textResult({ ok: true });
    }
  );

  server.registerTool(
    "clone_entry",
    {
      description: 'Duplicate an entry, appending " (Copy)" to its title.',
      inputSchema: { entryId: z.string() },
    },
    async ({ entryId }) => {
      const source = await getEntryForUser(userId, entryId);
      if (!source) return errorResult(`Entry ${entryId} not found`);

      const result = await createEntryForUser(userId, {
        title: `${source.title} (Copy)`,
        categoryId: source.categoryId,
        displayTitle: source.displayTitle,
        organization: source.organization,
        location: source.location,
        startDate: source.startDate,
        endDate: source.endDate,
        description: source.description,
        url: source.url,
        bullets: source.bullets,
        tags: source.tags,
      });
      if (!result.ok) return errorResult(result.error);
      return textResult(result.entry);
    }
  );

  server.registerTool(
    "list_entry_versions",
    {
      description: "List an entry's historical versions (pre-edit snapshots), most recent first.",
      inputSchema: { entryId: z.string() },
    },
    async ({ entryId }) => textResult(await listEntryVersionsForUser(userId, entryId))
  );

  server.registerTool(
    "create_category",
    {
      description: "Create a custom category for organizing entries.",
      inputSchema: { name: z.string().min(1).max(100) },
    },
    async ({ name }) => {
      const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const category = await prisma.category.create({
        data: { name, slug, isBuiltIn: false, userId },
      });
      return textResult(category);
    }
  );

  server.registerTool(
    "delete_category",
    {
      description: "Delete a custom category. Built-in categories cannot be deleted.",
      inputSchema: { categoryId: z.string() },
    },
    async ({ categoryId }) => {
      const { count } = await prisma.category.deleteMany({
        where: { id: categoryId, userId, isBuiltIn: false },
      });
      if (count === 0) return errorResult(`Category ${categoryId} not found or is built-in`);
      return textResult({ ok: true });
    }
  );
}
