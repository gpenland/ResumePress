"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export type IgnoredThread = {
  id: string;
  subject: string | null;
  participants: string[];
  lastMessageAt: Date | null;
};

type Props = {
  threads: IgnoredThread[];
  restoreMatch: (threadId: string) => Promise<void>;
};

// The undo path for deleting a Gmail-sourced interaction (which ignores the
// underlying thread instead of leaving a dangling "auto" match — see
// deleteInteraction in contacts/actions.ts) and for Triage's own "Ignore".
export default function IgnoredThreadsList({ threads, restoreMatch }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (threads.length === 0) return null;

  function handleRestore(threadId: string) {
    startTransition(async () => {
      await restoreMatch(threadId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-muted-foreground hover:text-foreground underline"
      >
        {open ? "Hide" : "Show"} {threads.length} ignored thread(s)
      </button>
      {open && (
        <div className="space-y-1.5">
          {threads.map((thread) => (
            <div key={thread.id} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border">
              <div className="min-w-0 flex-1">
                <p className="truncate">{thread.subject || "(no subject)"}</p>
                <p className="text-xs text-muted-foreground truncate">{thread.participants.join(", ")}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => handleRestore(thread.id)}
                disabled={isPending}
              >
                Restore
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
