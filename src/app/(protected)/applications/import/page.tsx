export const dynamic = "force-dynamic";

import NotionImportWizard from "@/components/applications/NotionImportWizard";
import { importNotionApplications } from "./actions";

export default function ImportApplicationsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Applications</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Import a CSV export from Notion or any spreadsheet — map its columns to fields below, preview, then
          confirm. One-time use, but safe to re-run if you map an ID column: matching rows update instead of
          duplicating.
        </p>
      </div>
      <NotionImportWizard importAction={importNotionApplications} />
    </div>
  );
}
