export const dynamic = "force-dynamic";

import Link from "next/link";
import { getUserId } from "@/lib/auth";
import { listContactsForUser } from "@/lib/contacts";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteContact } from "./actions";
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
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground text-sm mt-1">{contacts.length} total</p>
        </div>
        <Link href="/contacts/new" className={cn(buttonVariants())}>New Contact</Link>
      </div>

      <ContactsList contacts={contacts} followUpDue={followUpDue} deleteContact={deleteContact} />
    </div>
  );
}
