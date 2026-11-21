export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getContactForUser } from "@/lib/contacts";
import { listCompaniesForUser } from "@/lib/companies";
import ContactForm from "@/components/contacts/ContactForm";
import PageGrid from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
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
    <PageGrid
      header={<PageHeader back={{ href: `/contacts/${contact.id}`, label: contact.name }} title="Edit contact" />}
    >
      <Panel padded className="lg:w-1/2">
        <ContactForm
          companies={companies}
          contact={contact}
          action={updateContact.bind(null, contact.id)}
          submitLabel="Save changes"
        />
      </Panel>
    </PageGrid>
  );
}
