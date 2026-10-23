export const dynamic = "force-dynamic";

import { requireUserId } from "@/lib/auth";
import { getGmailConnectionStatus } from "@/lib/gmailAccount";
import { prisma } from "@/lib/prisma";
import { listAvailableLabelsForUser } from "@/lib/emailThreads";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import SubmitButton from "@/components/SubmitButton";
import Link from "next/link";
import { disconnectGmail, saveGmailSyncLabels, syncGmailNow } from "./actions";
import { cn } from "@/lib/utils";
import GmailSyncPanel from "@/components/gmail/GmailSyncPanel";

export default async function GmailSettingsPage() {
  const userId = await requireUserId();
  const status = await getGmailConnectionStatus(userId);

  let labels: Awaited<ReturnType<typeof listAvailableLabelsForUser>> = [];
  let labelsError: string | null = null;
  let selectedLabelIds: string[] = [];

  if (status.connected) {
    const account = await prisma.gmailAccount.findUnique({ where: { userId }, select: { syncLabelIds: true } });
    selectedLabelIds = account?.syncLabelIds ?? [];
    try {
      labels = await listAvailableLabelsForUser(userId);
    } catch (err) {
      labelsError = err instanceof Error ? err.message : "Could not load Gmail labels.";
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gmail</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Read-only access to chosen labels, used to attach email threads to contacts and
          applications. Entirely optional — nothing elsewhere requires a Gmail connection.
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
              <form action={disconnectGmail}>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sync</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
