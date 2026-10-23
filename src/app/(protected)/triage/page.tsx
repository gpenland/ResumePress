export const dynamic = "force-dynamic";

import { requireUserId } from "@/lib/auth";
import { listTriageThreadsForUser } from "@/lib/emailThreads";
import { listContactOptionsForUser } from "@/lib/contacts";
import { listApplicationOptionsForUser } from "@/lib/interactions";
import TriageList from "@/components/gmail/TriageList";
import { confirmEmailThreadMatch, ignoreEmailThreadMatch } from "./actions";

export default async function TriagePage() {
  const userId = await requireUserId();
  const [threads, contactOptions, applicationOptions] = await Promise.all([
    listTriageThreadsForUser(userId),
    listContactOptionsForUser(userId),
    listApplicationOptionsForUser(userId),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Email Triage</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gmail threads synced from your chosen labels that aren&apos;t confidently matched to a contact. Confirm, reassign, or ignore each one.
        </p>
      </div>

      <TriageList
        threads={threads}
        contactOptions={contactOptions}
        applicationOptions={applicationOptions}
        confirmMatch={confirmEmailThreadMatch}
        ignoreMatch={ignoreEmailThreadMatch}
      />
    </div>
  );
}
