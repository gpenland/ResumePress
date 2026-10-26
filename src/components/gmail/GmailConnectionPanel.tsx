"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import SubmitButton from "@/components/SubmitButton";
import Link from "next/link";
import { cn, nativeSelectClassName } from "@/lib/utils";
import type { GmailSyncStatus } from "@/lib/emailThreads";
import type { GmailLabel } from "@/lib/gmail";

type ConnectedProps = {
  connected: true;
  email: string;
  connectedAt: Date;
  initialSyncStatus: GmailSyncStatus;
  labels: GmailLabel[];
  labelsError: string | null;
  overrideLabelId: string | null;
  saveOverrideLabel: (labelId: string | null) => Promise<void>;
  startSync: () => Promise<{ started: boolean; error?: string }>;
  getSyncStatus: () => Promise<GmailSyncStatus>;
  cancelSync: () => Promise<{ cancelled: boolean }>;
  clearUnmatched: () => Promise<{ cleared: number }>;
  disconnect: () => Promise<void>;
};

type DisconnectedProps = { connected: false };

type Props = ConnectedProps | DisconnectedProps;

const POLL_INTERVAL_MS = 1500;

// Collapsed by default — connecting/reconfiguring Gmail is a rare, one-time
// chore, so the default view is a one-line status plus the one action
// (Sync now) worth surfacing on every visit. Expanding reveals the
// connected-since timestamp, the label override, and disconnect.
//
// Sync UX: a sync runs in the background on the server (see
// startGmailSyncInBackgroundForUser in emailThreads.ts) rather than as a
// single request this component awaits — it can run for minutes, far
// longer than a browser request (or any proxy in front of it) should be
// expected to survive. This component instead polls getSyncStatus while a
// sync is running, whether that sync was started by this click, by another
// tab, or by the scheduled cron job — so opening /email mid-sync (from any
// source) shows live progress immediately rather than a stale "idle" state
// that silently catches up later. A first-ever sync (no prior lastSyncAt)
// gets more reassuring copy, since scanning a whole inbox for the first
// time is the slowest, least-familiar case; later syncs show the same
// progress UI with lighter wording, since the user already knows what to
// expect.
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

  const {
    email,
    connectedAt,
    initialSyncStatus,
    labels,
    labelsError,
    overrideLabelId,
    saveOverrideLabel,
    startSync,
    getSyncStatus,
    cancelSync,
    clearUnmatched,
    disconnect,
  } = props;

  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<GmailSyncStatus>(initialSyncStatus);
  // Captured once, when a sync starts being observed — not re-derived from
  // syncStatus.lastSyncAt (which only updates once the sync finishes) — so
  // "is this the first sync" can't flip partway through its own run.
  const [isFirstSync, setIsFirstSync] = useState(initialSyncStatus.lastSyncAt === null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, startStarting] = useTransition();
  const [selectedLabelId, setSelectedLabelId] = useState(overrideLabelId ?? "");
  const [isSavingLabel, startSavingLabel] = useTransition();
  const [isClearing, startClearing] = useTransition();
  const [clearResult, setClearResult] = useState<string | null>(null);
  const [isCancelling, startCancelling] = useTransition();

  const isRunning = syncStatus.status === "running";
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasRunningRef = useRef(isRunning);

  useEffect(() => {
    function stopPolling() {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }

    if (!isRunning) {
      stopPolling();
      // Just finished (was running on the previous render, isn't now) —
      // refresh the page's own server data once so the triage list catches
      // up, instead of requiring a manual reload.
      if (wasRunningRef.current) router.refresh();
      wasRunningRef.current = false;
      return;
    }

    wasRunningRef.current = true;
    let cancelled = false;

    async function poll() {
      const next = await getSyncStatus();
      if (cancelled) return;
      setSyncStatus(next);
      if (next.status === "running") {
        pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  function handleSync() {
    setStartError(null);
    setIsFirstSync(syncStatus.lastSyncAt === null);
    startStarting(async () => {
      const result = await startSync();
      if (!result.started) {
        setStartError(result.error ?? "Could not start sync.");
        return;
      }
      // Optimistic: reflect "running" immediately rather than waiting for
      // the first poll tick, so the button disables right away.
      setSyncStatus((prev) => ({ ...prev, status: "running", total: null, done: 0, error: null }));
    });
  }

  function handleLabelChange(value: string) {
    setSelectedLabelId(value);
    startSavingLabel(async () => {
      await saveOverrideLabel(value || null);
      router.refresh();
    });
  }

  function handleCancel() {
    startCancelling(async () => {
      const result = await cancelSync();
      if (result.cancelled) {
        // Optimistic: stop reporting "running" immediately rather than
        // waiting for the next poll tick — the polling effect sees isRunning
        // flip to false and stops on its own.
        setSyncStatus((prev) => ({ ...prev, status: "idle", startedAt: null, error: null }));
      }
    });
  }

  function handleClearUnmatched() {
    setClearResult(null);
    startClearing(async () => {
      const result = await clearUnmatched();
      setClearResult(`Cleared ${result.cleared} unmatched thread${result.cleared === 1 ? "" : "s"} — Sync now to re-fetch them.`);
      router.refresh();
    });
  }

  const progressPct =
    syncStatus.total && syncStatus.total > 0 ? Math.min(100, ((syncStatus.done ?? 0) / syncStatus.total) * 100) : null;

  function statusLine(): string {
    if (isRunning) {
      if (isFirstSync) return "Running your first sync…";
      return "Syncing…";
    }
    if (syncStatus.status === "error") return "Last sync failed";
    return syncStatus.lastSyncAt ? `Synced ${syncStatus.lastSyncAt.toLocaleDateString()}` : "Never synced";
  }

  return (
    <div className="rounded-lg border px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{email}</p>
          <p className="text-xs text-muted-foreground truncate">{statusLine()}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button type="button" size="sm" onClick={handleSync} disabled={isRunning || isStarting}>
            {isRunning || isStarting ? "Syncing…" : "Sync now"}
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

      {isRunning && (
        <div className="space-y-1.5">
          {isFirstSync && (
            <p className="text-xs text-muted-foreground">
              Scanning your whole inbox for the first time — this can take a few minutes. Feel free to leave this
              page; progress picks back up when you return.
            </p>
          )}
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            {progressPct !== null ? (
              <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${progressPct}%` }} />
            ) : (
              <div className="h-full w-2/5 bg-primary/50 animate-pulse rounded-full" />
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {progressPct !== null ? `${syncStatus.done} of ${syncStatus.total} threads checked` : "Finding emails to check…"}
            </p>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling}
              className="text-xs text-muted-foreground hover:text-destructive underline shrink-0"
              title="Use if a sync looks stuck (e.g. after a server restart) — safe even if it's still actually running."
            >
              {isCancelling ? "Cancelling…" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {!isRunning && syncStatus.status === "error" && (
        <p className="text-xs text-destructive">{syncStatus.error}</p>
      )}
      {!isRunning && !syncStatus.error && syncStatus.total !== null && (
        <p className="text-xs text-muted-foreground">Checked {syncStatus.total} thread(s) on the last sync.</p>
      )}
      {startError && <p className="text-xs text-destructive">{startError}</p>}

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

          <div className="space-y-1.5 pt-2 border-t">
            <p className="text-sm font-medium">Debug: clear unmatched emails</p>
            <p className="text-xs text-muted-foreground">
              Deletes every unmatched thread (not confirmed/ignored ones) and resets the next sync back to a
              full inbox scan, instead of its normal incremental catch-up — for testing a clean resync.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearUnmatched}
              disabled={isClearing || isRunning}
            >
              {isClearing ? "Clearing…" : "Clear unmatched emails"}
            </Button>
            {clearResult && <p className="text-xs text-muted-foreground">{clearResult}</p>}
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
