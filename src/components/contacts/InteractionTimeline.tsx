"use client";

import type { Interaction } from "@prisma/client";
import DeleteItemButton from "@/components/DeleteItemButton";

type Props = {
  interactions: (Interaction & { emailThread?: { gmailUrl: string | null } | null })[];
  deleteInteraction: (interactionId: string) => Promise<void>;
};

export default function InteractionTimeline({ interactions, deleteInteraction }: Props) {
  if (interactions.length === 0) {
    return <p className="text-muted-foreground text-sm px-1">No interactions logged yet.</p>;
  }

  return (
    <div className="space-y-2">
      {interactions.map((i) => (
        <div key={i.id} className="flex items-start gap-3 text-sm px-1 py-1.5 border-b last:border-0">
          <span className="text-muted-foreground text-xs w-32 shrink-0 mt-0.5">
            {new Date(i.occurredAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <div className="flex-1 min-w-0">
            <span className="font-medium">{i.type}</span>
            <p className="text-muted-foreground text-xs mt-0.5">{i.summary}</p>
          </div>
          {i.emailThread?.gmailUrl && (
            <a
              href={i.emailThread.gmailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline hover:text-foreground shrink-0 mt-0.5"
            >
              Open email
            </a>
          )}
          <DeleteItemButton action={deleteInteraction.bind(null, i.id)} itemName={`${i.type} on ${new Date(i.occurredAt).toLocaleDateString()}`} />
        </div>
      ))}
    </div>
  );
}
