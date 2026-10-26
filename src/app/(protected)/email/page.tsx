export const dynamic = "force-dynamic";

import { requireUserId } from "@/lib/auth";
import { getGmailConnectionStatus } from "@/lib/gmailAccount";
import { prisma } from "@/lib/prisma";
import {
  listAvailableLabelsForUser,
  listTriageThreadsForUser,
  listRecentMatchedThreadsForUser,
  listIgnoredThreadsForUser,
  listApplicationPickerOptionsForUser,
} from "@/lib/emailThreads";
import { listContactOptionsForUser, listApplicationIdsByContactForUser } from "@/lib/contacts";
import { updateApplicationStatus } from "@/app/(protected)/applications/actions";
import { Badge } from "@/components/ui/badge";
import GmailConnectionPanel from "@/components/gmail/GmailConnectionPanel";
import TriageList from "@/components/gmail/TriageList";
import RecentEmailsList from "@/components/gmail/RecentEmailsList";
import IgnoredThreadsList from "@/components/gmail/IgnoredThreadsList";
import {
  disconnectGmail,
  saveOverrideLabel,
  syncGmailNow,
  confirmEmailThreadMatch,
  ignoreEmailThreadMatch,
  restoreEmailThreadMatch,
  createContactFromTriage,
  createApplicationFromTriage,
  bulkConfirmEmailThreadMatches,
  bulkIgnoreEmailThreadMatches,
  suggestMatchForThread,
} from "./actions";

export default async function EmailPage() {
  const userId = await requireUserId();
  const status = await getGmailConnectionStatus(userId);

  let labels: Awaited<ReturnType<typeof listAvailableLabelsForUser>> = [];
  let labelsError: string | null = null;
  let overrideLabelId: string | null = null;
  let threads: Awaited<ReturnType<typeof listTriageThreadsForUser>> = [];
  let recentThreads: Awaited<ReturnType<typeof listRecentMatchedThreadsForUser>> = [];
  let ignoredThreads: Awaited<ReturnType<typeof listIgnoredThreadsForUser>> = [];
  let contactOptions: Awaited<ReturnType<typeof listContactOptionsForUser>> = [];
  let applications: Awaited<ReturnType<typeof listApplicationPickerOptionsForUser>> = [];
  let applicationIdsByContact: Record<string, string[]> = {};

  if (status.connected) {
    const [account, threadsResult, ignoredResult, contactOptionsResult, applicationsResult, applicationIdsByContactResult] =
      await Promise.all([
        prisma.gmailAccount.findUnique({ where: { userId }, select: { syncLabelIds: true } }),
        listTriageThreadsForUser(userId),
        listIgnoredThreadsForUser(userId),
        listContactOptionsForUser(userId),
        listApplicationPickerOptionsForUser(userId),
        listApplicationIdsByContactForUser(userId),
      ]);
    overrideLabelId = account?.syncLabelIds[0] ?? null;
    threads = threadsResult;
    ignoredThreads = ignoredResult;
    contactOptions = contactOptionsResult;
    applications = applicationsResult;
    applicationIdsByContact = applicationIdsByContactResult;

    // Only needed to fill the space the triage queue leaves behind when it's empty.
    if (threads.length === 0) {
      recentThreads = await listRecentMatchedThreadsForUser(userId);
    }

    try {
      labels = await listAvailableLabelsForUser(userId);
    } catch (err) {
      labelsError = err instanceof Error ? err.message : "Could not load Gmail labels.";
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Email</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect Gmail to scan your inbox, then confirm, reassign, or ignore how each thread
          matches a contact or application. Optional; nothing else requires it.
        </p>
      </div>

      {status.connected ? (
        <GmailConnectionPanel
          connected
          email={status.email}
          connectedAt={status.connectedAt}
          lastSyncAt={status.lastSyncAt}
          labels={labels}
          labelsError={labelsError}
          overrideLabelId={overrideLabelId}
          saveOverrideLabel={saveOverrideLabel}
          syncNow={syncGmailNow}
          disconnect={disconnectGmail}
        />
      ) : (
        <GmailConnectionPanel connected={false} />
      )}

      {status.connected && (
        <>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Needs review</h2>
              {threads.length > 0 && <Badge variant="secondary">{threads.length}</Badge>}
            </div>
            {threads.length === 0 ? (
              <p className="text-sm text-muted-foreground">All caught up — nothing pending triage.</p>
            ) : (
              <TriageList
                threads={threads}
                contactOptions={contactOptions}
                applications={applications}
                applicationIdsByContact={applicationIdsByContact}
                confirmMatch={confirmEmailThreadMatch}
                ignoreMatch={ignoreEmailThreadMatch}
                bulkConfirmMatches={bulkConfirmEmailThreadMatches}
                bulkIgnoreMatches={bulkIgnoreEmailThreadMatches}
                createContact={createContactFromTriage}
                createApplication={createApplicationFromTriage}
                updateApplicationStatus={updateApplicationStatus}
                suggestMatch={suggestMatchForThread}
              />
            )}
          </div>

          {threads.length === 0 && <RecentEmailsList threads={recentThreads} />}

          <IgnoredThreadsList threads={ignoredThreads} restoreMatch={restoreEmailThreadMatch} />
        </>
      )}
    </div>
  );
}
