export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getApplicationForUser } from "@/lib/applications";
import { listCompaniesForUser } from "@/lib/companies";
import ApplicationForm from "@/components/applications/ApplicationForm";
import { updateApplication, autofillApplicationFromUrl } from "../../actions";

export default async function EditApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const [application, companies] = await Promise.all([
    getApplicationForUser(userId, id),
    listCompaniesForUser(userId),
  ]);
  if (!application) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Application</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {application.roleTitle} @ {application.company.name}
        </p>
      </div>
      <ApplicationForm
        companies={companies}
        application={application}
        action={updateApplication.bind(null, application.id)}
        submitLabel="Save Changes"
        autofillFromUrl={autofillApplicationFromUrl}
      />
    </div>
  );
}
