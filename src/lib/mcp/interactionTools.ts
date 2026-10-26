import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createInteractionForUser, deleteInteractionForUser } from "@/lib/interactions";
import { ignoreEmailThreadMatchForUser } from "@/lib/emailThreads";
import { textResult, errorResult } from "./shared";

/** Interactions: freeform logged touchpoints tied to a contact and/or application. */
export function registerInteractionTools(server: McpServer, userId: string): void {
  server.registerTool(
    "log_interaction",
    {
      description:
        "Log an interaction (call, email, meeting, etc.) tied to a contact and/or an application. At least one of contactId/applicationId should be set for it to be useful, but neither is required.",
      inputSchema: {
        type: z.string().min(1).max(100),
        occurredAt: z.string().min(1).max(50),
        summary: z.string().min(1).max(2000),
        contactId: z.string().nullable().optional(),
        applicationId: z.string().nullable().optional(),
      },
    },
    async (data) => {
      const result = await createInteractionForUser(userId, data);
      if (!result.ok) return errorResult(result.error);
      return textResult(result.interaction);
    }
  );

  server.registerTool(
    "delete_interaction",
    {
      description:
        "Delete an interaction. If it was mirrored from a Gmail thread, also marks that thread \"ignored\" (restorable from the email triage list) instead of leaving a dangling auto-match.",
      inputSchema: { interactionId: z.string() },
    },
    async ({ interactionId }) => {
      const interaction = await prisma.interaction.findFirst({ where: { id: interactionId, userId } });
      if (!interaction) return errorResult(`Interaction ${interactionId} not found`);

      const result = await deleteInteractionForUser(userId, interactionId);
      if (!result.ok) return errorResult(`Interaction ${interactionId} not found`);

      if (interaction.emailThreadId) {
        await ignoreEmailThreadMatchForUser(userId, interaction.emailThreadId);
      }
      return textResult({ ok: true });
    }
  );
}
