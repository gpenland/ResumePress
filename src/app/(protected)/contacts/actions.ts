"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import {
  createContactForUser,
  updateContactForUser,
  linkContactToApplicationForUser,
  unlinkContactFromApplicationForUser,
  type ContactInput,
} from "@/lib/contacts";
import { createInteractionForUser, deleteInteractionForUser } from "@/lib/interactions";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";

function parseList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function inputFromFormData(formData: FormData): ContactInput {
  return {
    name: formData.get("name") as string,
    companyName: (formData.get("companyName") as string) || null,
    title: (formData.get("title") as string) || null,
    emails: parseList(formData.get("emails") as string),
    linkedinUrl: (formData.get("linkedinUrl") as string) || null,
    phone: (formData.get("phone") as string) || null,
    howMet: (formData.get("howMet") as string) || null,
    metAt: (formData.get("metAt") as string) || null,
    tags: parseList(formData.get("tags") as string),
    nextFollowUpAt: (formData.get("nextFollowUpAt") as string) || null,
    notes: (formData.get("notes") as string) || null,
  };
}

export async function createContact(formData: FormData) {
  const userId = await requireUserId();
  const contact = await createContactForUser(userId, inputFromFormData(formData));

  revalidatePath("/contacts");
  redirect(`/contacts/${contact.id}`);
}

export async function updateContact(id: string, formData: FormData) {
  const userId = await requireUserId();
  const result = await updateContactForUser(userId, id, inputFromFormData(formData));
  if (!result.ok) notFound();

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  redirect(`/contacts/${id}`);
}

export async function deleteContact(id: string) {
  const userId = await requireUserId();
  const { count } = await prisma.contact.deleteMany({ where: { id, userId } });
  if (count === 0) notFound();

  revalidatePath("/contacts");
  redirect("/contacts");
}

/** Used by both the per-contact "Log interaction" form and the global quick-add. */
export async function logInteraction(formData: FormData) {
  const userId = await requireUserId();
  const result = await createInteractionForUser(userId, {
    type: formData.get("type") as string,
    occurredAt: (formData.get("occurredAt") as string) || new Date().toISOString(),
    summary: formData.get("summary") as string,
    contactId: (formData.get("contactId") as string) || null,
    applicationId: (formData.get("applicationId") as string) || null,
  });
  if (!result.ok) throw new Error(result.error);

  if (result.interaction.contactId) revalidatePath(`/contacts/${result.interaction.contactId}`);
  if (result.interaction.applicationId) revalidatePath(`/applications/${result.interaction.applicationId}`);
  revalidatePath("/contacts");
}

/** Takes only the interaction's own id — looks up which contact/application to revalidate itself, so callers on either side (contact or application detail page) can pass it directly with no `.bind`. */
export async function deleteInteraction(interactionId: string) {
  const userId = await requireUserId();
  const interaction = await prisma.interaction.findFirst({ where: { id: interactionId, userId } });
  if (!interaction) notFound();

  const result = await deleteInteractionForUser(userId, interactionId);
  if (!result.ok) notFound();

  if (interaction.contactId) revalidatePath(`/contacts/${interaction.contactId}`);
  if (interaction.applicationId) revalidatePath(`/applications/${interaction.applicationId}`);
}

export async function linkContactToApplication(contactId: string, applicationId: string, role: string) {
  const userId = await requireUserId();
  const result = await linkContactToApplicationForUser(userId, contactId, applicationId, role);
  if (!result.ok) notFound();

  revalidatePath(`/contacts/${contactId}`);
}

export async function unlinkContactFromApplication(contactId: string, applicationId: string) {
  const userId = await requireUserId();
  const result = await unlinkContactFromApplicationForUser(userId, contactId, applicationId);
  if (!result.ok) notFound();

  revalidatePath(`/contacts/${contactId}`);
}
