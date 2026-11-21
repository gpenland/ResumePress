export const dynamic = "force-dynamic";

import { requireUserId } from "@/lib/auth";
import { getGmailConnectionStatus } from "@/lib/gmailAccount";
import { prisma } from "@/lib/prisma";
import {
  listAvailableLabelsForUser,
  listTriageThreadsForUser,
  listRecentMatchedThreadsForUser,
  listStatusSuggestionThreadsForUser,
  listIgnoredThreadsForUser,
  listApplicationPickerOptionsForUser,
  getGmailSyncStatusForUser,
} from "@/lib/emailThreads";
import { listContactOptionsForUser, listApplicationIdsByContactForUser } from "@/lib/contacts";
import PageGrid from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import GmailConnectionPanel from "@/components/gmail/GmailConnectionPanel";
import TriageList from "@/components/gmail/TriageList";
import StatusSuggestionsList from "@/components/gmail/StatusSuggestionsList";
import RecentEmailsList from "@/components/gmail/RecentEmailsList";
import IgnoredThreadsList from "@/components/gmail/IgnoredThreadsList";
import {
  disconnectGmail,
  saveOverrideLabel,
  startGmailSync,
  getGmailSyncStatus,
  cancelSync,
  clearUnmatchedThreads,
  confirmEmailThreadMatch,
  ignoreEmailThreadMatch,
  restoreEmailThreadMatch,
  createContactFromTriage,
  createApplicationFromTriage,
  bulkConfirmEmailThreadMatches,
  bulkIgnoreEmailThreadMatches,
  suggestMatchForThread,
  applyEmailThreadStatusSuggestion,
  dismissEmailThreadStatusSuggestion,
} from "./actions";

export default async function EmailPage() {
  const userId = await requireUserId();
  const status = await getGmailConnectionStatus(userId);

  let labels: Awaited<ReturnType<typeof listAvailableLabelsForUser>> = [];
  let labelsError: string | null = null;
  let overrideLabelId: string | null = null;
  let syncStatus: Awaited<ReturnType<typeof getGmailSyncStatusForUser>> = {
    status: "idle",
    startedAt: null,
    total: null,
    done: null,
    error: null,
    lastSyncAt: null,
    needsReauth: false,
  };
  let threads: Awaited<ReturnType<typeof listTriageThreadsForUser>> = [];
  let recentThreads: Awaited<ReturnType<typeof listRecentMatchedThreadsForUser>> = [];
  let statusSuggestionThreads: Awaited<ReturnType<typeof listStatusSuggestionThreadsForUser>> = [];
  let ignoredThreads: Awaited<ReturnType<typeof listIgnoredThreadsForUser>> = [];
  let contactOptions: Awaited<ReturnType<typeof listContactOptionsForUser>> = [];
  let applications: Awaited<ReturnType<typeof listApplicationPickerOptionsForUser>> = [];
  let applicationIdsByContact: Record<string, string[]> = {};

  if (status.connected) {
    const [
      account,
      syncStatusResult,
      threadsResult,
      statusSuggestionsResult,
      ignoredResult,
      contactOptionsResult,
      applicationsResult,
      applicationIdsByContactResult,
    ] = await Promise.all([
      prisma.gmailAccount.findUnique({ where: { userId }, select: { syncLabelIds: true } }),
      getGmailSyncStatusForUser(userId),
      listTriageThreadsForUser(userId),
      listStatusSuggestionThreadsForUser(userId),
      listIgnoredThreadsForUser(userId),
      listContactOptionsForUser(userId),
      listApplicationPickerOptionsForUser(userId),
      listApplicationIdsByContactForUser(userId),
    ]);
    overrideLabelId = account?.syncLabelIds[0] ?? null;
    syncStatus = syncStatusResult;
    threads = threadsResult;
    statusSuggestionThreads = statusSuggestionsResult;
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

  const selfEmail = status.connected ? status.email : null;
  const connectionPanel = status.connected ? (
    <GmailConnectionPanel
      connected
      email={status.email}
      connectedAt={status.connectedAt}
      initialSyncStatus={syncStatus}
      labels={labels}
      labelsError={labelsError}
      overrideLabelId={overrideLabelId}
      saveOverrideLabel={saveOverrideLabel}
      startSync={startGmailSync}
      getSyncStatus={getGmailSyncStatus}
      cancelSync={cancelSync}
      clearUnmatched={clearUnmatchedThreads}
      disconnect={disconnectGmail}
    />
  ) : (
    <GmailConnectionPanel connected={false} />
  );

  return (
    <PageGrid
      header={
        <PageHeader
          eyebrow="Inbox"
          title="Email"
          description={
            status.connected
              ? "Confirm, reassign, or ignore how each thread matches a contact or application."
              : "Connect Gmail to scan your inbox, then confirm, reassign, or ignore how each thread matches a contact or application. Optional; nothing else requires it."
          }
        />
      }
    >
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-4">
        {/* The connection and its settings in the side column; the queues
            you actually work through get the other three. */}
        <aside className={status.connected ? "lg:sticky lg:top-20 lg:order-last" : "lg:col-span-2"}>
          <Panel title="Gmail" padded>
            {connectionPanel}
          </Panel>
        </aside>

        {status.connected && (
          <div className="space-y-8 lg:col-span-3">
            <StatusSuggestionsList
              threads={statusSuggestionThreads}
              applySuggestion={applyEmailThreadStatusSuggestion}
              dismissSuggestion={dismissEmailThreadStatusSuggestion}
            />

            <Panel title="Needs review" badge={threads.length > 0 ? threads.length : undefined} padded>
              {threads.length === 0 ? (
                <p className="text-sm text-muted-foreground">All caught up — nothing pending review.</p>
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
                  applyStatusSuggestion={applyEmailThreadStatusSuggestion}
                  dismissStatusSuggestion={dismissEmailThreadStatusSuggestion}
                  suggestMatch={suggestMatchForThread}
                  selfEmail={selfEmail}
                />
              )}
            </Panel>

            {threads.length === 0 && <RecentEmailsList threads={recentThreads} selfEmail={selfEmail} />}

            <IgnoredThreadsList threads={ignoredThreads} restoreMatch={restoreEmailThreadMatch} selfEmail={selfEmail} />
          </div>
        )}
      </div>
    </PageGrid>
  );
}
