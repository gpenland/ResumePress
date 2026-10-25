export const dynamic = "force-dynamic";

import NotionImportWizard from "@/components/applications/NotionImportWizard";
import { importNotionApplications } from "./actions";

export default function ImportApplicationsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Applications</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Import a CSV from Notion or any spreadsheet. Map the columns, preview, then confirm. Map an ID
          column to make re-imports update existing rows instead of duplicating them.
        </p>
      </div>
      <NotionImportWizard importAction={importNotionApplications} />
    </div>
  );
}
