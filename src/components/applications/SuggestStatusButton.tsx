"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { SuggestedStatus } from "@/lib/applications";
import { confidenceWord } from "@/lib/jev";

type Props = {
  applicationId: string;
  suggestStatus: (id: string) => Promise<SuggestedStatus>;
  updateStatus: (id: string, status: string) => Promise<void>;
};

// Suggestion-only: Apply calls the same updateStatus action a manual status
// change uses, so it writes a normal ApplicationStatusHistory entry — nothing
// here is auto-applied. See "AI Features (Jev)" in CLAUDE.md.
export default function SuggestStatusButton({ applicationId, suggestStatus, updateStatus }: Props) {
  const router = useRouter();
  const [isSuggesting, startSuggestTransition] = useTransition();
  const [isApplying, startApplyTransition] = useTransition();
  const [suggestion, setSuggestion] = useState<SuggestedStatus | null>(null);

  function handleSuggest() {
    setSuggestion(null);
    startSuggestTransition(async () => {
      setSuggestion(await suggestStatus(applicationId));
    });
  }

  function handleApply(status: string) {
    startApplyTransition(async () => {
      await updateStatus(applicationId, status);
      setSuggestion(null);
      router.refresh();
    });
  }

  if (suggestion?.ok && suggestion.status) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          Jev suggests: <span className="font-medium text-foreground">{suggestion.status}</span>
          {suggestion.confidence !== null && ` · ${confidenceWord(suggestion.confidence)}`}
        </span>
        <Button type="button" size="sm" onClick={() => handleApply(suggestion.status!)} disabled={isApplying}>
          {isApplying ? "Applying…" : "Apply"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setSuggestion(null)} disabled={isApplying}>
          Dismiss
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={handleSuggest} disabled={isSuggesting}>
        {isSuggesting ? "Checking…" : "Suggest status from emails"}
      </Button>
      {suggestion && !suggestion.ok && <span className="text-xs text-destructive">{suggestion.error}</span>}
      {suggestion?.ok && !suggestion.status && (
        <span className="text-xs text-muted-foreground">No status change suggested.</span>
      )}
    </div>
  );
}
