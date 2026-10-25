export const dynamic = "force-dynamic";

import { requireUserId } from "@/lib/auth";
import { getGmailConnectionStatus } from "@/lib/gmailAccount";
import { prisma } from "@/lib/prisma";
import {
  listAvailableLabelsForUser,
  listTriageThreadsForUser,
  listIgnoredThreadsForUser,
} from "@/lib/emailThreads";
import { listContactOptionsForUser, listApplicationIdsByContactForUser } from "@/lib/contacts";
import { listApplicationOptionsForUser } from "@/lib/interactions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import SubmitButton from "@/components/SubmitButton";
import Link from "next/link";
import { cn } from "@/lib/utils";
import GmailSyncPanel from "@/components/gmail/GmailSyncPanel";
import TriageList from "@/components/gmail/TriageList";
import IgnoredThreadsList from "@/components/gmail/IgnoredThreadsList";
import {
  disconnectGmail,
  saveGmailSyncLabels,
  syncGmailNow,
  confirmEmailThreadMatch,
  ignoreEmailThreadMatch,
  restoreEmailThreadMatch,
  createContactFromTriage,
} from "./actions";

export default async function EmailPage() {
  const userId = await requireUserId();
  const status = await getGmailConnectionStatus(userId);

  let labels: Awaited<ReturnType<typeof listAvailableLabelsForUser>> = [];
  let labelsError: string | null = null;
  let selectedLabelIds: string[] = [];
  let threads: Awaited<ReturnType<typeof listTriageThreadsForUser>> = [];
  let ignoredThreads: Awaited<ReturnType<typeof listIgnoredThreadsForUser>> = [];
  let contactOptions: Awaited<ReturnType<typeof listContactOptionsForUser>> = [];
  let applicationOptions: Awaited<ReturnType<typeof listApplicationOptionsForUser>> = [];
  let applicationIdsByContact: Record<string, string[]> = {};

  if (status.connected) {
    const [account, threadsResult, ignoredResult, contactOptionsResult, applicationOptionsResult, applicationIdsByContactResult] =
      await Promise.all([
        prisma.gmailAccount.findUnique({ where: { userId }, select: { syncLabelIds: true } }),
        listTriageThreadsForUser(userId),
        listIgnoredThreadsForUser(userId),
        listContactOptionsForUser(userId),
        listApplicationOptionsForUser(userId),
        listApplicationIdsByContactForUser(userId),
      ]);
    selectedLabelIds = account?.syncLabelIds ?? [];
    threads = threadsResult;
    ignoredThreads = ignoredResult;
    contactOptions = contactOptionsResult;
    applicationOptions = applicationOptionsResult;
    applicationIdsByContact = applicationIdsByContactResult;

    try {
      labels = await listAvailableLabelsForUser(userId);
    } catch (err) {
      labelsError = err instanceof Error ? err.message : "Could not load Gmail labels.";
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Email</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect Gmail to sync chosen labels, then confirm, reassign, or ignore how each thread
          matches to a contact and application. Entirely optional — nothing elsewhere requires a
          Gmail connection.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.connected ? (
            <>
              <p className="text-sm">
                Connected as <span className="font-medium">{status.email}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Connected {status.connectedAt?.toLocaleDateString()}
                {status.lastSyncAt
                  ? ` · Last synced ${status.lastSyncAt.toLocaleDateString()}`
                  : " · Never synced"}
              </p>
              {labelsError ? (
                <p className="text-sm text-destructive">{labelsError}</p>
              ) : (
                <GmailSyncPanel
                  labels={labels}
                  selectedLabelIds={selectedLabelIds}
                  saveLabels={saveGmailSyncLabels}
                  syncNow={syncGmailNow}
                />
              )}
              <form action={disconnectGmail} className="pt-2 border-t">
                <SubmitButton
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  pendingText="Disconnecting…"
                >
                  Disconnect
                </SubmitButton>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Not connected.</p>
              <Link
                href="/api/gmail/oauth/start"
                className={cn(buttonVariants({ size: "sm" }))}
              >
                Connect Gmail
              </Link>
            </>
          )}
        </CardContent>
      </Card>

      {status.connected && (
        <>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Needs review</h2>
              {threads.length > 0 && <Badge variant="secondary">{threads.length}</Badge>}
            </div>
            <TriageList
              threads={threads}
              contactOptions={contactOptions}
              applicationOptions={applicationOptions}
              applicationIdsByContact={applicationIdsByContact}
              confirmMatch={confirmEmailThreadMatch}
              ignoreMatch={ignoreEmailThreadMatch}
              createContact={createContactFromTriage}
            />
          </div>

          <IgnoredThreadsList threads={ignoredThreads} restoreMatch={restoreEmailThreadMatch} />
        </>
      )}
    </div>
  );
}
