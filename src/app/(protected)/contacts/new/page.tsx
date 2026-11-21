export const dynamic = "force-dynamic";

import { getUserId } from "@/lib/auth";
import { listCompaniesForUser } from "@/lib/companies";
import ContactForm from "@/components/contacts/ContactForm";
import PageGrid from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { createContact } from "../actions";

export default async function NewContactPage() {
  const userId = await getUserId();
  const companies = userId ? await listCompaniesForUser(userId) : [];

  return (
    <PageGrid
      header={
        <PageHeader
          back={{ href: "/contacts", label: "Contacts" }}
          title="New contact"
          description="Track a recruiter, referrer, or anyone else in your network"
        />
      }
    >
      {/* Forms span two grid columns — wide enough for the fields, narrow
          enough to read down. */}
      <Panel padded className="lg:w-1/2">
        <ContactForm companies={companies} action={createContact} submitLabel="Create contact" />
      </Panel>
    </PageGrid>
  );
}
