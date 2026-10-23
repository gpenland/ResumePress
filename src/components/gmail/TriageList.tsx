"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type TriageThread = {
  id: string;
  subject: string | null;
  snippet: string | null;
  participants: string[];
  lastMessageAt: Date | null;
  gmailUrl: string | null;
  matchedContact: { id: string; name: string } | null;
  matchedApplication: { id: string; roleTitle: string; company: { name: string } } | null;
};

type Props = {
  threads: TriageThread[];
  contactOptions: { id: string; name: string }[];
  applicationOptions: { id: string; label: string }[];
  confirmMatch: (threadId: string, contactId: string | null, applicationId: string | null) => Promise<void>;
  ignoreMatch: (threadId: string) => Promise<void>;
};

type RowProps = {
  thread: TriageThread;
  contactOptions: { id: string; name: string }[];
  applicationOptions: { id: string; label: string }[];
  confirmMatch: (threadId: string, contactId: string | null, applicationId: string | null) => Promise<void>;
  ignoreMatch: (threadId: string) => Promise<void>;
};

function TriageRow({ thread, contactOptions, applicationOptions, confirmMatch, ignoreMatch }: RowProps) {
  const router = useRouter();
  const [contactId, setContactId] = useState(thread.matchedContact?.id ?? "");
  const [applicationId, setApplicationId] = useState(thread.matchedApplication?.id ?? "");
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await confirmMatch(thread.id, contactId || null, applicationId || null);
      router.refresh();
    });
  }

  function handleIgnore() {
    startTransition(async () => {
      await ignoreMatch(thread.id);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{thread.subject || "(no subject)"}</p>
            <p className="text-xs text-muted-foreground truncate">{thread.participants.join(", ")}</p>
            {thread.snippet && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{thread.snippet}</p>}
          </div>
          <div className="text-right shrink-0">
            {thread.lastMessageAt && (
              <p className="text-xs text-muted-foreground">{new Date(thread.lastMessageAt).toLocaleDateString()}</p>
            )}
            {thread.gmailUrl && (
              <a href={thread.gmailUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline hover:text-foreground">
                Open in Gmail
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">No contact</option>
            {contactOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">No application</option>
            {applicationOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
          <Button type="button" size="sm" onClick={handleConfirm} disabled={isPending}>
            Confirm
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={handleIgnore} disabled={isPending}>
            Ignore
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TriageList({ threads, contactOptions, applicationOptions, confirmMatch, ignoreMatch }: Props) {
  if (threads.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center py-16 text-center gap-2">
          <p className="text-muted-foreground text-sm">All caught up — nothing pending triage.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {threads.map((thread) => (
        <TriageRow
          key={thread.id}
          thread={thread}
          contactOptions={contactOptions}
          applicationOptions={applicationOptions}
          confirmMatch={confirmMatch}
          ignoreMatch={ignoreMatch}
        />
      ))}
    </div>
  );
}
