export const dynamic = "force-dynamic";

import { getUserId } from "@/lib/auth";
import { listCompaniesForUser } from "@/lib/companies";
import { listResumesForUser } from "@/lib/resumes";
import ApplicationForm from "@/components/applications/ApplicationForm";
import PageGrid from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { createApplication, autofillApplicationFromUrl } from "../actions";

export default async function NewApplicationPage() {
  const userId = await getUserId();
  const [companies, resumes] = userId
    ? await Promise.all([listCompaniesForUser(userId), listResumesForUser(userId)])
    : [[], []];

  return (
    <PageGrid
      header={
        <PageHeader
          back={{ href: "/applications", label: "Applications" }}
          title="New application"
          description="Track a new internship application"
        />
      }
    >
      <Panel padded className="lg:w-1/2">
        <ApplicationForm
          companies={companies}
          resumes={resumes}
          action={createApplication}
          submitLabel="Create application"
          autofillFromUrl={autofillApplicationFromUrl}
        />
      </Panel>
    </PageGrid>
  );
}
