import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { identitySchema } from "@/lib/schemas/resumeEntry";
import { textResult, errorResult, compact } from "./shared";

/** Resume mutations beyond the original create_resume/get_resume/list_resumes/compile_resume. */
export function registerResumeManagementTools(server: McpServer, userId: string): void {
  server.registerTool(
    "update_resume_identity",
    {
      description: "Update a resume's name and identity block (name/email/phone/website/linkedin/github).",
      inputSchema: {
        resumeId: z.string(),
        name: z.string().min(1).max(200),
        identity: z.object(identitySchema.shape),
      },
    },
    async ({ resumeId, name, identity }) => {
      const { count } = await prisma.resume.updateMany({
        where: { id: resumeId, userId },
        data: { name, identity },
      });
      if (count === 0) return errorResult(`Resume ${resumeId} not found`);
      return textResult({ ok: true });
    }
  );

  server.registerTool(
    "update_resume_entries",
    {
      description: "Replace a resume's ordered list of entries (order in the array controls PDF ordering).",
      inputSchema: { resumeId: z.string(), entryIds: z.array(z.string()).max(100) },
    },
    async ({ resumeId, entryIds }) => {
      const resume = await prisma.resume.findFirst({ where: { id: resumeId, userId }, select: { id: true } });
      if (!resume) return errorResult(`Resume ${resumeId} not found`);

      if (entryIds.length > 0) {
        const owned = await prisma.entry.count({ where: { id: { in: entryIds }, userId } });
        if (owned !== entryIds.length) return errorResult("One or more entry ids are invalid.");
      }

      await prisma.$transaction([
        prisma.resumeEntry.deleteMany({ where: { resumeId } }),
        prisma.resumeEntry.createMany({
          data: entryIds.map((entryId, order) => ({ resumeId, entryId, order })),
        }),
      ]);
      return textResult({ ok: true });
    }
  );

  server.registerTool(
    "duplicate_resume",
    {
      description: "Duplicate a resume, including its ordered entries.",
      inputSchema: { resumeId: z.string() },
    },
    async ({ resumeId }) => {
      const original = await prisma.resume.findFirst({
        where: { id: resumeId, userId },
        include: { entries: true },
      });
      if (!original) return errorResult(`Resume ${resumeId} not found`);

      const copy = await prisma.$transaction(async (tx) => {
        const created = await tx.resume.create({
          data: {
            name: `${original.name} (copy)`,
            templateId: original.templateId,
            identity: original.identity ?? undefined,
            userId,
          },
        });
        if (original.entries.length > 0) {
          await tx.resumeEntry.createMany({
            data: original.entries.map((re) => ({
              resumeId: created.id,
              entryId: re.entryId,
              order: re.order,
            })),
          });
        }
        return created;
      });
      return textResult(compact(copy));
    }
  );

  server.registerTool(
    "delete_resume",
    {
      description: "Delete a resume.",
      inputSchema: { resumeId: z.string() },
    },
    async ({ resumeId }) => {
      const { count } = await prisma.resume.deleteMany({ where: { id: resumeId, userId } });
      if (count === 0) return errorResult(`Resume ${resumeId} not found`);
      return textResult({ ok: true });
    }
  );
}
