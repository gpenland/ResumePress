import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { globalSearch } from "@/lib/search";
import { textResult } from "./shared";

export function registerSearchTools(server: McpServer, userId: string): void {
  server.registerTool(
    "search",
    {
      description: "Case-insensitive substring search across applications, contacts, and interaction summaries.",
      inputSchema: { query: z.string().min(1).max(200) },
    },
    async ({ query }) => textResult(await globalSearch(userId, query))
  );
}
