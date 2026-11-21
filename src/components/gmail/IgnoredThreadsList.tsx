"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/Panel";
import { GRID_INSET } from "@/components/PageGrid";
import { cn } from "@/lib/utils";
import { decodeHtmlEntities, otherParticipants } from "@/lib/emailThreadsShared";

export type IgnoredThread = {
  id: string;
  subject: string | null;
  participants: string[];
  lastMessageAt: Date | null;
};

type Props = {
  threads: IgnoredThread[];
  restoreMatch: (threadId: string) => Promise<void>;
  selfEmail: string | null;
};

// The undo path for deleting a Gmail-sourced interaction (which ignores the
// underlying thread instead of leaving a dangling "auto" match — see
// deleteInteraction in contacts/actions.ts) and for Triage's own "Ignore".
export default function IgnoredThreadsList({ threads, restoreMatch, selfEmail }: Props) {
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
    <Panel
      title="Ignored"
      badge={threads.length}
      actions={
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Hide" : "Show"}
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
        </Button>
      }
    >
      {open && (
        <div className="divide-y">
          {threads.map((thread) => (
            <div key={thread.id} className={cn("flex items-center gap-2 py-2.5 text-sm", GRID_INSET)}>
              <div className="min-w-0 flex-1">
                <p className="truncate">{decodeHtmlEntities(thread.subject || "(no subject)")}</p>
                <p className="truncate text-xs text-muted-foreground">{otherParticipants(thread.participants, selfEmail).join(", ")}</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => handleRestore(thread.id)} disabled={isPending}>
                Restore
              </Button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
