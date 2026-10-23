export const dynamic = "force-dynamic";

import { getUserId } from "@/lib/auth";
import { listCompaniesForUser } from "@/lib/companies";
import ContactForm from "@/components/contacts/ContactForm";
import { createContact } from "../actions";

export default async function NewContactPage() {
  const userId = await getUserId();
  const companies = userId ? await listCompaniesForUser(userId) : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Contact</h1>
        <p className="text-muted-foreground text-sm mt-1">Track a recruiter, referrer, or anyone else in your network</p>
      </div>
      <ContactForm companies={companies} action={createContact} submitLabel="Create Contact" />
    </div>
  );
}
