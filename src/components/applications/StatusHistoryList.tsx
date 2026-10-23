"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationStatusHistory } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  applicationId: string;
  history: ApplicationStatusHistory[];
  logUpdate: (applicationId: string, note: string) => Promise<void>;
  setNote: (applicationId: string, historyId: string, note: string) => Promise<void>;
};

function describeChange(h: ApplicationStatusHistory): string {
  if (h.fromStatus === null) return `Created as ${h.toStatus}`;
  if (h.fromStatus === h.toStatus) return "Update";
  return `${h.fromStatus} → ${h.toStatus}`;
}

export default function StatusHistoryList({ applicationId, history, logUpdate, setNote }: Props) {
  const router = useRouter();
  const [newNote, setNewNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function handleLogUpdate(e: React.FormEvent) {
    e.preventDefault();
    const note = newNote.trim();
    if (!note) return;
    startTransition(async () => {
      await logUpdate(applicationId, note);
      setNewNote("");
      router.refresh();
    });
  }

  function startEdit(h: ApplicationStatusHistory) {
    setEditingId(h.id);
    setEditValue(h.note ?? "");
  }

  function handleSaveNote(historyId: string) {
    startTransition(async () => {
      await setNote(applicationId, historyId, editValue.trim());
      setEditingId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleLogUpdate} className="flex gap-2">
        <Input
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder='Log an update, e.g. "Completed first interview"'
          className="flex-1"
        />
        <Button type="submit" variant="outline" size="sm" disabled={isPending || !newNote.trim()}>
          Log update
        </Button>
      </form>

      <div className="space-y-2">
        {history.map((h) => (
          <div key={h.id} className="text-sm px-1 py-1.5 border-b last:border-0">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs w-32 shrink-0">
                {new Date(h.changedAt).toLocaleString()}
              </span>
              <span>{describeChange(h)}</span>
              {editingId !== h.id && (
                <button
                  type="button"
                  onClick={() => startEdit(h)}
                  className="text-xs text-muted-foreground hover:text-foreground ml-auto"
                >
                  {h.note ? "Edit note" : "Add note"}
                </button>
              )}
            </div>
            {editingId === h.id ? (
              <div className="flex gap-2 mt-1 ml-32">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Button type="button" size="sm" onClick={() => handleSaveNote(h.id)} disabled={isPending}>
                  Save
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              h.note && <p className="text-muted-foreground text-xs mt-0.5 ml-32">{h.note}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
