"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import SubmitButton from "@/components/SubmitButton";
import Link from "next/link";
import { cn, nativeSelectClassName } from "@/lib/utils";
import type { SyncResult } from "@/lib/emailThreads";
import type { GmailLabel } from "@/lib/gmail";

type ConnectedProps = {
  connected: true;
  email: string;
  connectedAt: Date;
  lastSyncAt: Date | null;
  labels: GmailLabel[];
  labelsError: string | null;
  overrideLabelId: string | null;
  saveOverrideLabel: (labelId: string | null) => Promise<void>;
  syncNow: () => Promise<SyncResult>;
  disconnect: () => Promise<void>;
};

type DisconnectedProps = { connected: false };

type Props = ConnectedProps | DisconnectedProps;

// Collapsed by default — connecting/reconfiguring Gmail is a rare, one-time
// chore, so the default view is a one-line status plus the one action
// (Sync now) worth surfacing on every visit. Expanding reveals the
// connected-since timestamp and disconnect, unchanged.
export default function GmailConnectionPanel(props: Props) {
  if (!props.connected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
        <p className="text-sm text-muted-foreground">Gmail not connected</p>
        <Link href="/api/gmail/oauth/start" className={cn(buttonVariants({ size: "sm" }))}>
          Connect Gmail
        </Link>
      </div>
    );
  }

  const { email, connectedAt, lastSyncAt, labels, labelsError, overrideLabelId, saveOverrideLabel, syncNow, disconnect } =
    props;

  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [isSyncing, startSyncing] = useTransition();
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [selectedLabelId, setSelectedLabelId] = useState(overrideLabelId ?? "");
  const [isSavingLabel, startSavingLabel] = useTransition();

  function handleSync() {
    setSyncResult(null);
    startSyncing(async () => {
      const result = await syncNow();
      setSyncResult(result);
      router.refresh();
    });
  }

  function handleLabelChange(value: string) {
    setSelectedLabelId(value);
    startSavingLabel(async () => {
      await saveOverrideLabel(value || null);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{email}</p>
          <p className="text-xs text-muted-foreground truncate">
            {lastSyncAt ? `Synced ${lastSyncAt.toLocaleDateString()}` : "Never synced"}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button type="button" size="sm" onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? "Syncing…" : "Sync now"}
          </Button>
          <button
            type="button"
            onClick={() => setExpanded((o) => !o)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            {expanded ? "Hide" : "Manage"}
          </button>
        </div>
      </div>

      {syncResult && (
        <p className={`text-xs ${syncResult.ok ? "text-muted-foreground" : "text-destructive"}`}>
          {syncResult.ok
            ? `Synced ${syncResult.threadsUpserted} thread(s)${syncResult.rematched > 0 ? `, rematched ${syncResult.rematched} previously unmatched` : ""}.`
            : syncResult.error}
        </p>
      )}

      {expanded && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-xs text-muted-foreground">Connected {connectedAt.toLocaleDateString()}</p>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Always include a label</p>
            <p className="text-xs text-muted-foreground">
              Jev skips anything it doesn&apos;t think is recruiting-related. Tag an email with this label in
              Gmail to force it into triage regardless — useful for something Jev missed, or older mail outside
              the normal scan.
            </p>
            {labelsError ? (
              <p className="text-xs text-destructive">{labelsError}</p>
            ) : (
              <select
                value={selectedLabelId}
                onChange={(e) => handleLabelChange(e.target.value)}
                disabled={isSavingLabel}
                className={nativeSelectClassName("sm")}
              >
                <option value="">No override label</option>
                {labels.map((label) => (
                  <option key={label.id} value={label.id}>
                    {label.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <form action={disconnect} className="pt-2 border-t">
            <SubmitButton
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              pendingText="Disconnecting…"
            >
              Disconnect
            </SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
