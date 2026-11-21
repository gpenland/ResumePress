export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getApplicationForUser } from "@/lib/applications";
import { listCompaniesForUser } from "@/lib/companies";
import ApplicationForm from "@/components/applications/ApplicationForm";
import PageGrid from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
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
    <PageGrid
      header={
        <PageHeader
          back={{ href: `/applications/${application.id}`, label: application.company.name }}
          title="Edit application"
          description={`${application.roleTitle} @ ${application.company.name}`}
        />
      }
    >
      <Panel padded className="lg:w-1/2">
        <ApplicationForm
          companies={companies}
          application={application}
          action={updateApplication.bind(null, application.id)}
          submitLabel="Save changes"
          autofillFromUrl={autofillApplicationFromUrl}
        />
      </Panel>
    </PageGrid>
  );
}
