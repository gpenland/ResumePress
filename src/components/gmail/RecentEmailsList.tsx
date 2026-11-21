import { decodeHtmlEntities, otherParticipants } from "@/lib/emailThreadsShared";
import { formatShortDate } from "@/lib/dateFormat";
import { Panel } from "@/components/Panel";
import { GRID_INSET } from "@/components/PageGrid";
import { cn } from "@/lib/utils";

export type RecentEmailThread = {
  id: string;
  subject: string | null;
  snippet: string | null;
  participants: string[];
  lastMessageAt: Date | null;
  gmailUrl: string | null;
  matchedContact: { id: string; name: string } | null;
  matchedApplication: { id: string; roleTitle: string; company: { name: string } } | null;
};

// Read-only — shown in place of the triage queue once it's empty, so the
// page isn't just an "all caught up" line with nothing else to look at.
export default function RecentEmailsList({ threads, selfEmail }: { threads: RecentEmailThread[]; selfEmail: string | null }) {
  if (threads.length === 0) return null;

  return (
    <Panel title="Recent emails">
      <div className="divide-y">
        {threads.map((thread) => (
          <div key={thread.id} className={cn("flex items-start justify-between gap-3 py-3", GRID_INSET)}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{decodeHtmlEntities(thread.subject || "(no subject)")}</p>
              <p className="truncate text-xs text-muted-foreground">{otherParticipants(thread.participants, selfEmail).join(", ")}</p>
              {(thread.matchedContact || thread.matchedApplication) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Matched to{" "}
                  {[
                    thread.matchedContact?.name,
                    thread.matchedApplication && `${thread.matchedApplication.company.name} — ${thread.matchedApplication.roleTitle}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              {thread.lastMessageAt && <p className="text-xs text-muted-foreground">{formatShortDate(thread.lastMessageAt)}</p>}
              {thread.gmailUrl && (
                <a href={thread.gmailUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline hover:text-foreground">
                  Open in Gmail
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
