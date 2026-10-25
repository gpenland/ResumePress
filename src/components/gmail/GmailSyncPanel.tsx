"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { GmailLabel } from "@/lib/gmail";
import type { SyncResult } from "@/lib/emailThreads";

type Props = {
  labels: GmailLabel[];
  selectedLabelIds: string[];
  saveLabels: (formData: FormData) => Promise<void>;
  syncNow: () => Promise<SyncResult>;
};

export default function GmailSyncPanel({ labels, selectedLabelIds, saveLabels, syncNow }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(new Set(selectedLabelIds));
  const [isSaving, startSaving] = useTransition();
  const [isSyncing, startSyncing] = useTransition();
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  // Collapsed by default once labels are already configured — the day-to-day
  // action is reviewing triage, not re-visiting setup. Opens by default for
  // first-time setup (nothing selected yet).
  const [settingsOpen, setSettingsOpen] = useState(selectedLabelIds.length === 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Built from the `selected` Set directly rather than reading a <form> ref —
  // the label-picker form only mounts while the settings disclosure is open,
  // but "Sync now" (outside the disclosure) also needs to persist the
  // current selection first.
  function labelsFormData(): FormData {
    const data = new FormData();
    for (const id of selected) data.append("labelIds", id);
    return data;
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startSaving(async () => {
      await saveLabels(labelsFormData());
    });
  }

  function handleSync() {
    setSyncResult(null);
    startSyncing(async () => {
      // Always persist the current checkbox state first — otherwise a
      // checked-but-unsaved label would silently get left out of the sync.
      await saveLabels(labelsFormData());
      const result = await syncNow();
      setSyncResult(result);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" size="sm" onClick={handleSync} disabled={isSyncing || selected.size === 0}>
          {isSyncing ? "Syncing…" : "Sync now"}
        </Button>
        <button
          type="button"
          onClick={() => setSettingsOpen((o) => !o)}
          className="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
        >
          {settingsOpen ? "Hide" : "Edit"} sync settings
        </button>
      </div>
      {syncResult && (
        <p className={`text-xs ${syncResult.ok ? "text-muted-foreground" : "text-destructive"}`}>
          {syncResult.ok
            ? `Synced ${syncResult.threadsUpserted} thread(s)${syncResult.rematched > 0 ? `, rematched ${syncResult.rematched} previously unmatched` : ""}.`
            : syncResult.error}
        </p>
      )}

      {settingsOpen && (
        <form onSubmit={handleSave} className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Labels to sync</p>
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {labels.map((label) => (
              <div key={label.id} className="flex items-center gap-2" onClick={() => toggle(label.id)}>
                <Checkbox
                  name="labelIds"
                  value={label.id}
                  checked={selected.has(label.id)}
                  onCheckedChange={() => toggle(label.id)}
                  className="pointer-events-none"
                />
                <span className="text-sm">{label.name}</span>
              </div>
            ))}
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save label selection"}
          </Button>
        </form>
      )}
    </div>
  );
}
