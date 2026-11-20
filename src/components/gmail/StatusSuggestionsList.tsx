"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/applications/StatusBadge";
import { decodeHtmlEntities } from "@/lib/emailThreadsShared";
import { confidenceWord } from "@/lib/jev";
import { formatShortDate } from "@/lib/dateFormat";

export type StatusSuggestionThread = {
  id: string;
  subject: string | null;
  snippet: string | null;
  participants: string[];
  lastMessageAt: Date | null;
  gmailUrl: string | null;
  jevSuggestedStatus: string | null;
  jevSuggestedStatusConf: number | null;
  matchedContact: { id: string; name: string } | null;
  matchedApplication: { id: string; roleTitle: string; status: string; company: { name: string } } | null;
};

type Props = {
  threads: StatusSuggestionThread[];
  applySuggestion: (threadId: string) => Promise<void>;
  dismissSuggestion: (threadId: string) => Promise<void>;
};

// Already-matched emails Jev thinks should move their application's status
// (e.g. a rejection matched to an application still marked "Applied"). These
// never reach the triage queue, which is unmatched-only — this is their one
// place to be acted on. Apply uses the thread's stored suggestion server-side;
// nothing is changed without a click.
export default function StatusSuggestionsList({ threads, applySuggestion, dismissSuggestion }: Props) {
  if (threads.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Suggested status updates</h2>
        <Badge variant="secondary">{threads.length}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Matched emails that Jev thinks change where an application stands. Nothing changes until you apply it.
      </p>
      <div className="space-y-1.5">
        {threads.map((thread) => (
          <StatusSuggestionRow
            key={thread.id}
            thread={thread}
            applySuggestion={applySuggestion}
            dismissSuggestion={dismissSuggestion}
          />
        ))}
      </div>
    </div>
  );
}

function StatusSuggestionRow({
  thread,
  applySuggestion,
  dismissSuggestion,
}: {
  thread: StatusSuggestionThread;
  applySuggestion: (threadId: string) => Promise<void>;
  dismissSuggestion: (threadId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(false);
  const app = thread.matchedApplication;
  if (hidden || !app || !thread.jevSuggestedStatus) return null;

  function handleApply() {
    startTransition(async () => {
      await applySuggestion(thread.id);
      setHidden(true);
      router.refresh();
    });
  }

  function handleDismiss() {
    setHidden(true);
    startTransition(async () => {
      await dismissSuggestion(thread.id);
    });
  }

  return (
    <Card>
      <CardContent className="py-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{decodeHtmlEntities(thread.subject || "(no subject)")}</p>
            {thread.snippet && (
              <p className="text-xs text-muted-foreground line-clamp-2">{decodeHtmlEntities(thread.snippet)}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              <Link href={`/applications/${app.id}`} className="underline hover:text-foreground">
                {app.roleTitle} @ {app.company.name}
              </Link>
              {thread.matchedContact && ` · ${thread.matchedContact.name}`}
            </p>
          </div>
          <div className="text-right shrink-0">
            {thread.lastMessageAt && (
              <p className="text-xs text-muted-foreground">{formatShortDate(thread.lastMessageAt)}</p>
            )}
            {thread.gmailUrl && (
              <a
                href={thread.gmailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline hover:text-foreground"
              >
                Open in Gmail
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <StatusBadge status={app.status} />
          <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
          <StatusBadge status={thread.jevSuggestedStatus} />
          {thread.jevSuggestedStatusConf !== null && (
            <span className="text-muted-foreground">{confidenceWord(thread.jevSuggestedStatusConf)}</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" size="sm" onClick={handleApply} disabled={isPending}>
              {isPending ? "Applying…" : `Mark ${thread.jevSuggestedStatus}`}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={handleDismiss} disabled={isPending}>
              Dismiss
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
