import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createContactForUser,
  updateContactForUser,
  listContactsForUser,
  getContactForUser,
  linkContactToApplicationForUser,
  unlinkContactFromApplicationForUser,
} from "@/lib/contacts";
import { textResult, errorResult } from "./shared";

// Mirrors ContactInput (src/lib/contacts.ts) with length caps — same reasoning
// as compile_resume's inline schema, since this path bypasses the ContactForm UI.
const contactFieldsSchema = {
  name: z.string().min(1).max(200),
  companyName: z.string().max(200).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  emails: z.array(z.string().max(200)).max(20).optional(),
  linkedinUrl: z.string().max(500).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  howMet: z.string().max(500).nullable().optional(),
  metAt: z.string().max(50).nullable().optional(),
  tags: z.array(z.string().max(100)).max(30).optional(),
  nextFollowUpAt: z.string().max(50).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
};

/** Contacts CRUD + their many-to-many links to Applications. */
export function registerContactTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_contacts",
    {
      description: "List this user's contacts, optionally filtered to only those due for follow-up.",
      inputSchema: { followUpDue: z.boolean().optional() },
    },
    async ({ followUpDue }) => textResult(await listContactsForUser(userId, { followUpDue }))
  );

  server.registerTool(
    "get_contact",
    {
      description: "Get a contact by id, including their company, interactions, and linked applications.",
      inputSchema: { contactId: z.string() },
    },
    async ({ contactId }) => {
      const contact = await getContactForUser(userId, contactId);
      if (!contact) return errorResult(`Contact ${contactId} not found`);
      return textResult(contact);
    }
  );

  server.registerTool(
    "create_contact",
    {
      description:
        "Create a new contact. companyName (if given) is matched case-insensitively to an existing company or creates a new one.",
      inputSchema: contactFieldsSchema,
    },
    async (data) => textResult(await createContactForUser(userId, data))
  );

  server.registerTool(
    "update_contact",
    {
      description: "Update a contact's fields.",
      inputSchema: { contactId: z.string(), ...contactFieldsSchema },
    },
    async ({ contactId, ...data }) => {
      const result = await updateContactForUser(userId, contactId, data);
      if (!result.ok) return errorResult(`Contact ${contactId} not found`);
      return textResult(result);
    }
  );

  server.registerTool(
    "delete_contact",
    { description: "Delete a contact.", inputSchema: { contactId: z.string() } },
    async ({ contactId }) => {
      const { count } = await prisma.contact.deleteMany({ where: { id: contactId, userId } });
      if (count === 0) return errorResult(`Contact ${contactId} not found`);
      return textResult({ ok: true });
    }
  );

  server.registerTool(
    "link_contact_to_application",
    {
      description: "Link a contact to an application with a free-form role (e.g. \"Recruiter\", \"Hiring Manager\"). Updates the role if already linked.",
      inputSchema: { contactId: z.string(), applicationId: z.string(), role: z.string().max(200) },
    },
    async ({ contactId, applicationId, role }) => {
      const result = await linkContactToApplicationForUser(userId, contactId, applicationId, role);
      if (!result.ok) return errorResult("Contact or application not found");
      return textResult(result);
    }
  );

  server.registerTool(
    "unlink_contact_from_application",
    {
      description: "Remove the link between a contact and an application.",
      inputSchema: { contactId: z.string(), applicationId: z.string() },
    },
    async ({ contactId, applicationId }) => {
      const result = await unlinkContactFromApplicationForUser(userId, contactId, applicationId);
      if (!result.ok) return errorResult("Link not found");
      return textResult(result);
    }
  );
}
