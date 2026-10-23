"use client";

import { useRef, useState, useTransition } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState(new Set(selectedLabelIds));
  const [isSaving, startSaving] = useTransition();
  const [isSyncing, startSyncing] = useTransition();
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startSaving(async () => {
      await saveLabels(new FormData(formRef.current!));
    });
  }

  function handleSync() {
    setSyncResult(null);
    startSyncing(async () => {
      // Always persist the current checkbox state first — otherwise a
      // checked-but-unsaved label would silently get left out of the sync.
      await saveLabels(new FormData(formRef.current!));
      const result = await syncNow();
      setSyncResult(result);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <form ref={formRef} onSubmit={handleSave} className="space-y-2">
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

      <div className="space-y-2 border-t pt-4">
        <Button type="button" size="sm" onClick={handleSync} disabled={isSyncing || selected.size === 0}>
          {isSyncing ? "Syncing…" : "Sync now"}
        </Button>
        {syncResult && (
          <p className={`text-xs ${syncResult.ok ? "text-muted-foreground" : "text-destructive"}`}>
            {syncResult.ok ? `Synced ${syncResult.threadsUpserted} thread(s).` : syncResult.error}
          </p>
        )}
      </div>
    </div>
  );
}
