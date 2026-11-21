export const dynamic = "force-dynamic";

import NotionImportWizard from "@/components/applications/NotionImportWizard";
import PageGrid from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";

import { importNotionApplications } from "./actions";

export default function ImportApplicationsPage() {
  return (
    <PageGrid
      header={
        <PageHeader
          back={{ href: "/applications", label: "Applications" }}
          title="Import applications"
          description={
            <p className="max-w-2xl">
              Import a CSV from Notion or any spreadsheet. Map the columns, preview, then confirm. Map an ID
              column to make re-imports update existing rows instead of duplicating them.
            </p>
          }
        />
      }
    >
      <div className="lg:w-3/4">
        <NotionImportWizard importAction={importNotionApplications} />
      </div>
    </PageGrid>
  );
}
