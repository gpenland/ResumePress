export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getContactForUser } from "@/lib/contacts";
import { listCompaniesForUser } from "@/lib/companies";
import ContactForm from "@/components/contacts/ContactForm";
import { updateContact } from "../../actions";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const [contact, companies] = await Promise.all([
    getContactForUser(userId, id),
    listCompaniesForUser(userId),
  ]);
  if (!contact) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Edit Contact</h1>
        <p className="text-muted-foreground text-sm mt-1">{contact.name}</p>
      </div>
      <ContactForm
        companies={companies}
        contact={contact}
        action={updateContact.bind(null, contact.id)}
        submitLabel="Save Changes"
      />
    </div>
  );
}
