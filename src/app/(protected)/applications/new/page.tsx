export const dynamic = "force-dynamic";

import { getUserId } from "@/lib/auth";
import { listCompaniesForUser } from "@/lib/companies";
import ApplicationForm from "@/components/applications/ApplicationForm";
import { createApplication, autofillApplicationFromUrl } from "../actions";

export default async function NewApplicationPage() {
  const userId = await getUserId();
  const companies = userId ? await listCompaniesForUser(userId) : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">New Application</h1>
        <p className="text-muted-foreground text-sm mt-1">Track a new internship application</p>
      </div>
      <ApplicationForm
        companies={companies}
        action={createApplication}
        submitLabel="Create Application"
        autofillFromUrl={autofillApplicationFromUrl}
      />
    </div>
  );
}
