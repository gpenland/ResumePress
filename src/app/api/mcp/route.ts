import { NextResponse } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getUserIdFromBearerToken } from "@/lib/apiToken";
import { registerResumePressTools } from "@/lib/mcpTools";

export async function POST(req: Request) {
  const userId = await getUserIdFromBearerToken(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const server = new McpServer({ name: "resumepress", version: "1.0.0" });
  registerResumePressTools(server, userId);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(req);
}
