import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { listCompaniesForUser, getCompanyForUser } from "@/lib/companies";
import {
  createApplicationForUser,
  updateApplicationForUser,
  updateApplicationStatusForUser,
  logApplicationUpdateForUser,
  setApplicationHistoryNoteForUser,
  deleteApplicationStatusHistoryEntryForUser,
  bulkUpdateApplicationStatusForUser,
  bulkDeleteApplicationsForUser,
  listApplicationsForUser,
  getApplicationForUser,
  getApplicationPipelineStatsForUser,
  getApplicationStatusFlowForUser,
  importMappedApplicationsForUser,
} from "@/lib/applications";
import { createResumeSnapshotForUser } from "@/lib/resumes";
import { textResult, errorResult } from "./shared";

// Mirrors ApplicationInput (src/lib/applications.ts) with length caps, since
// this path bypasses the ApplicationForm UI's own validation — same reasoning
// as compile_resume's inline schema.
const applicationFieldsSchema = {
  companyName: z.string().min(1).max(200),
  roleTitle: z.string().min(1).max(200),
  term: z.string().max(100).nullable().optional(),
  status: z.string().max(50).optional(),
  appliedAt: z.string().max(50).nullable().optional(),
  postingUrl: z.string().max(500).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  source: z.string().max(200).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
};

// Mirrors MappedApplicationRow (src/lib/notionImportShared.ts) — the already-
// mapped-to-fields shape importMappedApplicationsForUser consumes. The CSV
// parsing/column-guessing step before this is a pure UI convenience with no
// server analog worth exposing; an agent importing applications just builds
// this shape directly instead, the same way compile_resume takes
// already-assembled inline data rather than a "parse a .tex file" tool.
const importRowSchema = z.object({
  companyName: z.string().min(1).max(200),
  roleTitle: z.string().min(1).max(200),
  term: z.string().max(100).nullable(),
  status: z.string().max(200).nullable(), // comma-joined status history, see parseStatusHistory
  appliedAt: z.string().max(50).nullable(),
  postingUrl: z.string().max(500).nullable(),
  location: z.string().max(200).nullable(),
  source: z.string().max(200).nullable(),
  notes: z.string().max(5000).nullable(),
  externalId: z.string().max(200).nullable(),
});

// Same cap as the CSV importer's own actions.ts — defensive against a huge/malformed batch.
const MAX_IMPORT_ROWS = 2000;

/** Companies + Applications (list/kanban CRUD, status history, bulk actions, resume pinning, pipeline stats). */
export function registerCompanyApplicationTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_companies",
    { description: "List this user's companies.", inputSchema: {} },
    async () => textResult(await listCompaniesForUser(userId))
  );

  server.registerTool(
    "get_company",
    { description: "Get a company by id.", inputSchema: { companyId: z.string() } },
    async ({ companyId }) => {
      const company = await getCompanyForUser(userId, companyId);
      if (!company) return errorResult(`Company ${companyId} not found`);
      return textResult(company);
    }
  );

  server.registerTool(
    "list_applications",
    {
      description: "List this user's applications, optionally filtered by status or company.",
      inputSchema: {
        status: z.string().max(50).optional(),
        companyId: z.string().optional(),
      },
    },
    async (opts) => textResult(await listApplicationsForUser(userId, opts))
  );

  server.registerTool(
    "get_application",
    {
      description:
        "Get an application by id, including its company, resume/snapshot, status history, linked contacts, and interactions.",
      inputSchema: { applicationId: z.string() },
    },
    async ({ applicationId }) => {
      const application = await getApplicationForUser(userId, applicationId);
      if (!application) return errorResult(`Application ${applicationId} not found`);
      return textResult(application);
    }
  );

  server.registerTool(
    "create_application",
    {
      description:
        "Create a new application. companyName is matched case-insensitively to an existing company or creates a new one.",
      inputSchema: applicationFieldsSchema,
    },
    async (data) => textResult(await createApplicationForUser(userId, data))
  );

  server.registerTool(
    "update_application",
    {
      description: "Update an application's fields. Changing status also writes a status-history entry.",
      inputSchema: { applicationId: z.string(), ...applicationFieldsSchema },
    },
    async ({ applicationId, ...data }) => {
      const result = await updateApplicationForUser(userId, applicationId, data);
      if (!result.ok) return errorResult(`Application ${applicationId} not found`);
      return textResult(result);
    }
  );

  server.registerTool(
    "update_application_status",
    {
      description: "Change an application's status, writing a status-history entry. No-ops if the status is unchanged.",
      inputSchema: { applicationId: z.string(), status: z.string().min(1).max(50) },
    },
    async ({ applicationId, status }) => {
      const result = await updateApplicationStatusForUser(userId, applicationId, status);
      if (!result.ok) return errorResult(`Application ${applicationId} not found`);
      return textResult(result);
    }
  );

  server.registerTool(
    "log_application_update",
    {
      description: 'Add a note-only status-history entry ("log update") without changing the application\'s status.',
      inputSchema: { applicationId: z.string(), note: z.string().min(1).max(2000) },
    },
    async ({ applicationId, note }) => {
      const result = await logApplicationUpdateForUser(userId, applicationId, note);
      if (!result.ok) return errorResult(`Application ${applicationId} not found`);
      return textResult(result);
    }
  );

  server.registerTool(
    "set_application_history_note",
    {
      description: "Add or edit the note on an existing status-history entry.",
      inputSchema: { applicationId: z.string(), historyId: z.string(), note: z.string().max(2000) },
    },
    async ({ historyId, note }) => {
      const result = await setApplicationHistoryNoteForUser(userId, historyId, note);
      if (!result.ok) return errorResult(`History entry ${historyId} not found`);
      return textResult(result);
    }
  );

  server.registerTool(
    "delete_application_status_history_entry",
    {
      description:
        "Delete the most recent status-history entry for an application, reverting its status if that entry was a real status change. Can only delete the single latest entry (never the creation entry).",
      inputSchema: { applicationId: z.string(), historyId: z.string() },
    },
    async ({ applicationId, historyId }) => {
      const result = await deleteApplicationStatusHistoryEntryForUser(userId, applicationId, historyId);
      if (!result.ok) return errorResult("History entry not found, not owned, or not the latest entry");
      return textResult(result);
    }
  );

  server.registerTool(
    "delete_application",
    { description: "Delete an application.", inputSchema: { applicationId: z.string() } },
    async ({ applicationId }) => {
      const { count } = await prisma.application.deleteMany({ where: { id: applicationId, userId } });
      if (count === 0) return errorResult(`Application ${applicationId} not found`);
      return textResult({ ok: true });
    }
  );

  server.registerTool(
    "bulk_update_application_status",
    {
      description: "Set the same status on multiple applications at once. Ids not owned by the caller are silently skipped.",
      inputSchema: { applicationIds: z.array(z.string()).max(500), status: z.string().min(1).max(50) },
    },
    async ({ applicationIds, status }) => {
      await bulkUpdateApplicationStatusForUser(userId, applicationIds, status);
      return textResult({ ok: true });
    }
  );

  server.registerTool(
    "bulk_delete_applications",
    {
      description: "Delete multiple applications at once.",
      inputSchema: { applicationIds: z.array(z.string()).max(500) },
    },
    async ({ applicationIds }) => {
      await bulkDeleteApplicationsForUser(userId, applicationIds);
      return textResult({ ok: true });
    }
  );

  server.registerTool(
    "get_application_pipeline_stats",
    {
      description: "Pipeline stats powering the dashboard: totals, active/offer counts, offer rate, and weekly new-application deltas.",
      inputSchema: {},
    },
    async () => textResult(await getApplicationPipelineStatsForUser(userId))
  );

  server.registerTool(
    "get_application_status_flow",
    {
      description: "Aggregated status-transition edges (source -> target -> count) across all applications, for a Sankey-style flow view.",
      inputSchema: {},
    },
    async () => textResult(await getApplicationStatusFlowForUser(userId))
  );

  server.registerTool(
    "attach_resume_to_application",
    {
      description:
        "Attach (or re-attach) a resume to an application by freezing a fresh snapshot of its current content. Later edits to the resume won't retroactively change what's pinned to this application.",
      inputSchema: { applicationId: z.string(), resumeId: z.string() },
    },
    async ({ applicationId, resumeId }) => {
      const snapshot = await createResumeSnapshotForUser(userId, resumeId);
      if (!snapshot) return errorResult(`Resume ${resumeId} not found`);

      const { count } = await prisma.application.updateMany({
        where: { id: applicationId, userId },
        data: { resumeId, resumeSnapshotId: snapshot.id },
      });
      if (count === 0) return errorResult(`Application ${applicationId} not found`);
      return textResult({ ok: true, snapshotId: snapshot.id });
    }
  );

  server.registerTool(
    "import_applications",
    {
      description:
        "Bulk-import applications from already-mapped rows (same shape the CSV/Notion importer UI produces after column mapping). Idempotent: a row whose externalId matches an existing application's updates it instead of creating a duplicate. status may be a comma-joined history (oldest first, e.g. \"Applied, Rejected\") to seed status-history transitions, not just the current value.",
      inputSchema: { rows: z.array(importRowSchema).max(MAX_IMPORT_ROWS) },
    },
    async ({ rows }) => textResult(await importMappedApplicationsForUser(userId, rows))
  );

  server.registerTool(
    "detach_resume_from_application",
    {
      description: "Remove an application's attached resume/snapshot.",
      inputSchema: { applicationId: z.string() },
    },
    async ({ applicationId }) => {
      const { count } = await prisma.application.updateMany({
        where: { id: applicationId, userId },
        data: { resumeId: null, resumeSnapshotId: null },
      });
      if (count === 0) return errorResult(`Application ${applicationId} not found`);
      return textResult({ ok: true });
    }
  );
}
