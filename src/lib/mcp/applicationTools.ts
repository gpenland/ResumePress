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
  listApplicationCycleOptionsForUser,
  importMappedApplicationsForUser,
  APPLICATION_STATUSES,
  type ApplicationInput,
} from "@/lib/applications";
import { createResumeSnapshotForUser } from "@/lib/resumes";
import { textResult, errorResult, compact } from "./shared";

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
    async () => textResult(compact(await listCompaniesForUser(userId)))
  );

  server.registerTool(
    "get_company",
    { description: "Get a company by id.", inputSchema: { companyId: z.string() } },
    async ({ companyId }) => {
      const company = await getCompanyForUser(userId, companyId);
      if (!company) return errorResult(`Company ${companyId} not found`);
      return textResult(compact(company));
    }
  );

  server.registerTool(
    "list_application_statuses",
    {
      description:
        "List the suggested application statuses. Status is still a free-form string (not a DB enum) — any value " +
        "is accepted — but create/update tools case-fold a status against this list (e.g. \"interviewing\" -> " +
        "\"Interviewing\") so pipeline stats and the status-flow view don't silently split the same status across " +
        "two casings.",
      inputSchema: {},
    },
    async () => textResult(APPLICATION_STATUSES)
  );

  server.registerTool(
    "list_applications",
    {
      description:
        "List this user's applications, optionally filtered by status, company, or recruiting cycle. A cycle is named by its Fall's " +
        "calendar year (e.g. 2026 covers Fall 2026 - Summer 2027) and is derived from each application's term field (falling back to " +
        "appliedAt) — see get_application_pipeline_stats for the same concept applied to stats.",
      inputSchema: {
        status: z.string().max(50).optional(),
        companyId: z.string().optional(),
        cycles: z.array(z.number().int()).optional(),
      },
    },
    async (opts) => textResult(compact(await listApplicationsForUser(userId, opts)))
  );

  server.registerTool(
    "get_application",
    {
      description:
        "Get an application by id. Returns a compact set of core fields (company, resume/snapshot ids, status, " +
        "etc.) by default. Pass include to add status history, linked contacts, and/or interactions — e.g. " +
        "include: ['interactions', 'threads'] also surfaces each interaction's linked Gmail thread (subject, " +
        "gmailUrl). interactionsLimit caps how many interactions come back (most recent first, default 20).",
      inputSchema: {
        applicationId: z.string(),
        include: z.array(z.enum(["history", "contacts", "interactions", "threads"])).optional(),
        interactionsLimit: z.number().int().positive().max(100).optional(),
      },
    },
    async ({ applicationId, include, interactionsLimit }) => {
      const application = await getApplicationForUser(userId, applicationId);
      if (!application) return errorResult(`Application ${applicationId} not found`);

      const { statusHistory, contacts, interactions, ...core } = application;
      const result: Record<string, unknown> = compact(core);

      if (include?.includes("history")) {
        result.statusHistory = compact(statusHistory);
      }
      if (include?.includes("contacts")) {
        result.contacts = compact(contacts.map((ac) => ({ role: ac.role, contact: ac.contact })));
      }
      if (include?.includes("interactions")) {
        const includeThreads = include.includes("threads");
        result.interactions = compact(
          interactions.slice(0, interactionsLimit ?? 20).map(({ emailThread, ...rest }) => ({
            ...rest,
            emailThread: includeThreads && emailThread
              ? { subject: emailThread.subject, gmailUrl: emailThread.gmailUrl }
              : undefined,
          }))
        );
      }

      return textResult(result);
    }
  );

  server.registerTool(
    "create_application",
    {
      description:
        "Create a new application. companyName is matched case-insensitively to an existing company or creates a new one.",
      inputSchema: applicationFieldsSchema,
    },
    async (data) => textResult(compact(await createApplicationForUser(userId, data)))
  );

  server.registerTool(
    "update_application",
    {
      description:
        "Partially update an application — only pass the fields you want to change; anything you omit keeps its " +
        "current value. Pass a field explicitly as null to clear it (where nullable). Changing status also writes " +
        "a status-history entry.",
      inputSchema: {
        applicationId: z.string(),
        ...applicationFieldsSchema,
        // Unlike applicationFieldsSchema's own companyName/roleTitle (required —
        // create_application needs them), both are optional here so a caller can
        // change e.g. just a note without having to resend the whole record.
        companyName: z.string().min(1).max(200).optional(),
        roleTitle: z.string().min(1).max(200).optional(),
      },
    },
    async ({ applicationId, ...data }) => {
      const existing = await prisma.application.findFirst({
        where: { id: applicationId, userId },
        include: { company: true },
      });
      if (!existing) return errorResult(`Application ${applicationId} not found`);

      const merged: ApplicationInput = {
        companyName: data.companyName ?? existing.company.name,
        roleTitle: data.roleTitle ?? existing.roleTitle,
        term: "term" in data ? data.term : existing.term,
        status: data.status ?? existing.status,
        appliedAt: "appliedAt" in data ? data.appliedAt : existing.appliedAt?.toISOString() ?? null,
        postingUrl: "postingUrl" in data ? data.postingUrl : existing.postingUrl,
        location: "location" in data ? data.location : existing.location,
        source: "source" in data ? data.source : existing.source,
        notes: "notes" in data ? data.notes : existing.notes,
      };

      const result = await updateApplicationForUser(userId, applicationId, merged);
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
      description:
        "Pipeline stats powering the dashboard: totals, active/offer counts, offer rate, and weekly new-application deltas. " +
        "Pass cycles to scope stats to one or more recruiting cycles (each named by its Fall's calendar year, e.g. 2026 covers " +
        "Fall 2026 - Summer 2027); omit for all cycles.",
      inputSchema: { cycles: z.array(z.number().int()).optional() },
    },
    async ({ cycles }) => textResult(await getApplicationPipelineStatsForUser(userId, { cycles }))
  );

  server.registerTool(
    "get_application_status_flow",
    {
      description:
        "Aggregated status-transition edges (source -> target -> count) across all applications, for a Sankey-style flow view. " +
        "Pass cycles to scope to one or more recruiting cycles (see get_application_pipeline_stats); omit for all cycles.",
      inputSchema: { cycles: z.array(z.number().int()).optional() },
    },
    async ({ cycles }) => textResult(await getApplicationStatusFlowForUser(userId, { cycles }))
  );

  server.registerTool(
    "list_application_cycle_options",
    {
      description:
        "List recruiting-cycle years present across this user's applications (plus the current cycle), newest first — the same " +
        "options the dashboard/applications-page cycle filter offers. Each year names a cycle by its Fall (e.g. 2026 = Fall 2026 - " +
        "Summer 2027).",
      inputSchema: {},
    },
    async () => textResult(await listApplicationCycleOptionsForUser(userId))
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
