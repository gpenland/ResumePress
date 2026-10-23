import { prisma } from "@/lib/prisma";
import type { Interaction } from "@prisma/client";

export type InteractionInput = {
  type: string;
  occurredAt: string;
  summary: string;
  contactId?: string | null;
  applicationId?: string | null;
};

export type CreateInteractionResult =
  | { ok: true; interaction: Interaction }
  | { ok: false; error: string };

export async function createInteractionForUser(
  userId: string,
  data: InteractionInput
): Promise<CreateInteractionResult> {
  if (data.contactId) {
    const contact = await prisma.contact.findFirst({ where: { id: data.contactId, userId } });
    if (!contact) return { ok: false, error: "Contact not found" };
  }
  if (data.applicationId) {
    const application = await prisma.application.findFirst({ where: { id: data.applicationId, userId } });
    if (!application) return { ok: false, error: "Application not found" };
  }

  const occurredAt = new Date(data.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) {
    return { ok: false, error: "Invalid date" };
  }

  const interaction = await prisma.interaction.create({
    data: {
      type: data.type,
      occurredAt,
      summary: data.summary,
      contactId: data.contactId || null,
      applicationId: data.applicationId || null,
      userId,
    },
  });
  return { ok: true, interaction };
}

export async function deleteInteractionForUser(userId: string, interactionId: string): Promise<{ ok: boolean }> {
  const { count } = await prisma.interaction.deleteMany({ where: { id: interactionId, userId } });
  return { ok: count > 0 };
}

/** Minimal id+label list for pickers (e.g. the global "Log interaction" quick-add). */
export async function listApplicationOptionsForUser(userId: string) {
  const applications = await prisma.application.findMany({
    where: { userId },
    select: { id: true, roleTitle: true, company: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return applications.map((a) => ({ id: a.id, label: `${a.roleTitle} @ ${a.company.name}` }));
}
