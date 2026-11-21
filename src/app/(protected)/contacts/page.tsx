export const dynamic = "force-dynamic";

import Link from "next/link";
import { getUserId } from "@/lib/auth";
import { listContactsForUser } from "@/lib/contacts";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import PageGrid from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";
import ContactsList from "@/components/contacts/ContactsList";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ followUp?: string }>;
}) {
  const { followUp } = await searchParams;
  const userId = await getUserId();
  const followUpDue = followUp === "due";

  const contacts = userId ? await listContactsForUser(userId, { followUpDue }) : [];

  return (
    <PageGrid
      header={
        <PageHeader
          eyebrow="Network"
          title="Contacts"
          description={`${contacts.length} total`}
          actions={
            <Link href="/contacts/new" className={cn(buttonVariants())}>
              New contact
            </Link>
          }
        />
      }
    >
      <ContactsList contacts={contacts} followUpDue={followUpDue} />
    </PageGrid>
  );
}
