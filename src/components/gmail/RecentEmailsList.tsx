import { Card, CardContent } from "@/components/ui/card";

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
// page isn't just a dashed "all caught up" box with nothing else to look at.
export default function RecentEmailsList({ threads }: { threads: RecentEmailThread[] }) {
  if (threads.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Recent emails</h2>
      <div className="space-y-1.5">
        {threads.map((thread) => (
          <Card key={thread.id}>
            <CardContent className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{thread.subject || "(no subject)"}</p>
                  <p className="text-xs text-muted-foreground truncate">{thread.participants.join(", ")}</p>
                  {(thread.matchedContact || thread.matchedApplication) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Matched to{" "}
                      {[
                        thread.matchedContact?.name,
                        thread.matchedApplication &&
                          `${thread.matchedApplication.roleTitle} @ ${thread.matchedApplication.company.name}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {thread.lastMessageAt && (
                    <p className="text-xs text-muted-foreground">{new Date(thread.lastMessageAt).toLocaleDateString()}</p>
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
