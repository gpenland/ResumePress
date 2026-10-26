import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getGmailConnectionStatus, disconnectGmailAccount } from "@/lib/gmailAccount";
import { createContactForUser } from "@/lib/contacts";
import { createApplicationForUser } from "@/lib/applications";
import {
  syncGmailForUser,
  listAvailableLabelsForUser,
  updateSyncLabelsForUser,
  clearUnmatchedThreadsForUser,
  getEmailSyncStatsForUser,
  listTriageThreadsForUser,
  listIgnoredThreadsForUser,
  confirmEmailThreadMatchForUser,
  ignoreEmailThreadMatchForUser,
  restoreEmailThreadMatchForUser,
} from "@/lib/emailThreads";
import { textResult, errorResult } from "./shared";

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Gmail connection + sync + triage. Mirrors /email's actions.ts exactly;
 * "connect" itself isn't exposed here since it's a browser OAuth redirect
 * that can't run over a bearer-token MCP call. This is the least-proven
 * module in the codebase (see CLAUDE.md "Gmail sync") — treat tool results
 * accordingly.
 */
export function registerEmailTools(server: McpServer, userId: string): void {
  server.registerTool(
    "get_gmail_connection_status",
    { description: "Check whether Gmail is connected, and when it last synced.", inputSchema: {} },
    async () => textResult(await getGmailConnectionStatus(userId))
  );

  server.registerTool(
    "list_gmail_labels",
    {
      description: "List the Gmail labels available to pick as the triage-override label (requires Gmail to be connected).",
      inputSchema: {},
    },
    async () => {
      try {
        return textResult(await listAvailableLabelsForUser(userId));
      } catch (err) {
        return errorResult(errMessage(err));
      }
    }
  );

  server.registerTool(
    "save_override_label",
    {
      description:
        "Set the manual triage-override label: any thread carrying this label is always pulled into sync and always eligible for triage, regardless of Jev's recruiting classification or the recency window. Pass null/omit to clear it.",
      inputSchema: { labelId: z.string().nullable() },
    },
    async ({ labelId }) => {
      await updateSyncLabelsForUser(userId, labelId ? [labelId] : []);
      return textResult({ ok: true });
    }
  );

  server.registerTool(
    "sync_gmail_now",
    {
      description:
        "Trigger a Gmail sync: scans the inbox (read and unread, regardless of label, capped at the 1000 most recently active threads) plus any thread carrying the override label (see save_override_label), matches them to contacts/applications, eagerly runs Jev classification on unmatched ones (recruiting-related?, guessed job/contact, suggested status change), and re-checks previously unmatched threads. Requires Gmail connected.",
      inputSchema: {},
    },
    async () => {
      const result = await syncGmailForUser(userId);
      if (!result.ok) return errorResult(result.error);
      return textResult(result);
    }
  );

  server.registerTool(
    "clear_unmatched_threads",
    {
      description:
        "Debug tool: deletes every unmatched email thread so the next sync re-fetches and re-classifies them from scratch. Doesn't touch confirmed/ignored threads.",
      inputSchema: {},
    },
    async () => textResult(await clearUnmatchedThreadsForUser(userId))
  );

  server.registerTool(
    "disconnect_gmail",
    { description: "Disconnect the connected Gmail account.", inputSchema: {} },
    async () => {
      await disconnectGmailAccount(userId);
      return textResult({ ok: true });
    }
  );

  server.registerTool(
    "get_email_sync_stats",
    { description: "Email sync stats: connection status, last sync time, and needs-review/matched/total thread counts.", inputSchema: {} },
    async () => textResult(await getEmailSyncStatsForUser(userId))
  );

  server.registerTool(
    "list_triage_threads",
    {
      description:
        "List unmatched email threads awaiting manual triage — excludes anything Jev explicitly classified as not recruiting-related, unless it carries the override label (see save_override_label).",
      inputSchema: {},
    },
    async () => textResult(await listTriageThreadsForUser(userId))
  );

  server.registerTool(
    "list_ignored_threads",
    { description: "List email threads that were ignored (dismissed from triage).", inputSchema: {} },
    async () => textResult(await listIgnoredThreadsForUser(userId))
  );

  server.registerTool(
    "confirm_email_thread_match",
    {
      description: "Confirm an email thread's contact/application match, mirroring it onto that contact's/application's interaction timeline.",
      inputSchema: {
        threadId: z.string(),
        contactId: z.string().nullable(),
        applicationId: z.string().nullable(),
      },
    },
    async ({ threadId, contactId, applicationId }) => {
      const result = await confirmEmailThreadMatchForUser(userId, threadId, contactId, applicationId);
      if (!result.ok) return errorResult(`Thread ${threadId} not found, or contact/application not owned by this user`);
      return textResult(result);
    }
  );

  server.registerTool(
    "ignore_email_thread_match",
    {
      description: "Dismiss an email thread from triage, clearing any match. Restorable via restore_email_thread_match.",
      inputSchema: { threadId: z.string() },
    },
    async ({ threadId }) => {
      const result = await ignoreEmailThreadMatchForUser(userId, threadId);
      if (!result.ok) return errorResult(`Thread ${threadId} not found`);
      return textResult(result);
    }
  );

  server.registerTool(
    "restore_email_thread_match",
    {
      description: "Undo ignore_email_thread_match: moves a thread back to unmatched so it reappears in triage.",
      inputSchema: { threadId: z.string() },
    },
    async ({ threadId }) => {
      const result = await restoreEmailThreadMatchForUser(userId, threadId);
      if (!result.ok) return errorResult(`Thread ${threadId} not found`);
      return textResult(result);
    }
  );

  server.registerTool(
    "bulk_confirm_email_thread_matches",
    {
      description: "Confirm matches for multiple email threads at once.",
      inputSchema: {
        items: z
          .array(
            z.object({
              threadId: z.string(),
              contactId: z.string().nullable(),
              applicationId: z.string().nullable(),
            })
          )
          .max(200),
      },
    },
    async ({ items }) => {
      for (const item of items) {
        await confirmEmailThreadMatchForUser(userId, item.threadId, item.contactId, item.applicationId);
      }
      return textResult({ ok: true });
    }
  );

  server.registerTool(
    "bulk_ignore_email_thread_matches",
    {
      description: "Dismiss multiple email threads from triage at once.",
      inputSchema: { threadIds: z.array(z.string()).max(200) },
    },
    async ({ threadIds }) => {
      for (const threadId of threadIds) {
        await ignoreEmailThreadMatchForUser(userId, threadId);
      }
      return textResult({ ok: true });
    }
  );

  server.registerTool(
    "create_contact_from_triage",
    {
      description: "Create a bare-bones contact (name + one email) from an unmatched triage thread's sender. Doesn't confirm the thread's match itself.",
      inputSchema: { name: z.string().min(1).max(200), email: z.string().max(200).nullable().optional() },
    },
    async ({ name, email }) => {
      const contact = await createContactForUser(userId, { name, emails: email ? [email] : [] });
      return textResult({ id: contact.id, name: contact.name });
    }
  );

  server.registerTool(
    "create_application_from_triage",
    {
      description:
        "Create a new application from an unmatched triage thread Jev flagged as recruiting-related but not matching anything tracked yet. Doesn't confirm the thread's match itself.",
      inputSchema: { companyName: z.string().min(1).max(200), roleTitle: z.string().min(1).max(200) },
    },
    async ({ companyName, roleTitle }) => {
      const application = await createApplicationForUser(userId, { companyName, roleTitle });
      return textResult({ id: application.id, roleTitle: application.roleTitle, companyName });
    }
  );
}
