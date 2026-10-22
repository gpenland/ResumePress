export const dynamic = "force-dynamic";

import { requireUserId } from "@/lib/auth";
import { getGmailConnectionStatus } from "@/lib/gmailAccount";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import SubmitButton from "@/components/SubmitButton";
import Link from "next/link";
import { disconnectGmail } from "./actions";
import { cn } from "@/lib/utils";

export default async function GmailSettingsPage() {
  const userId = await requireUserId();
  const status = await getGmailConnectionStatus(userId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gmail</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Read-only access to a chosen label, used to attach email threads to contacts and
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
                  : " · Never synced (label sync not built yet)"}
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
    </div>
  );
}
