"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import ApplicationPicker from "@/components/gmail/ApplicationPicker";
import ContactPicker from "@/components/gmail/ContactPicker";
import type { ApplicationPickerOption } from "@/lib/emailThreadsShared";
import type { SuggestedMatch } from "@/lib/emailThreads";

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

type CreateContact = (name: string, email: string | null) => Promise<{ id: string; name: string }>;

// The in-progress contact/application pick for one triage row. Lifted up
// into TriageList (keyed by thread id) so the bulk "Confirm selected" handler
// can read every selected row's own current pick when building its batch
// call, instead of each row owning this state in isolation.
type Pick = { contactId: string; applicationId: string };

type Props = {
  threads: TriageThread[];
  contactOptions: { id: string; name: string }[];
  applications: ApplicationPickerOption[];
  applicationIdsByContact: Record<string, string[]>;
  confirmMatch: (threadId: string, contactId: string | null, applicationId: string | null) => Promise<void>;
  ignoreMatch: (threadId: string) => Promise<void>;
  bulkConfirmMatches: (
    items: { threadId: string; contactId: string | null; applicationId: string | null }[]
  ) => Promise<void>;
  bulkIgnoreMatches: (threadIds: string[]) => Promise<void>;
  createContact: CreateContact;
  suggestMatch: (threadId: string) => Promise<SuggestedMatch>;
};

type RowProps = {
  thread: TriageThread;
  contactOptions: { id: string; name: string }[];
  applications: ApplicationPickerOption[];
  applicationIdsByContact: Record<string, string[]>;
  confirmMatch: (threadId: string, contactId: string | null, applicationId: string | null) => Promise<void>;
  ignoreMatch: (threadId: string) => Promise<void>;
  createContact: CreateContact;
  suggestMatch: (threadId: string) => Promise<SuggestedMatch>;
  selected: boolean;
  onToggleSelected: () => void;
  pick: Pick;
  onPickChange: (pick: Pick) => void;
};

function TriageRow({
  thread,
  contactOptions,
  applications,
  applicationIdsByContact,
  confirmMatch,
  ignoreMatch,
  createContact,
  suggestMatch,
  selected,
  onToggleSelected,
  pick,
  onPickChange,
}: RowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSuggesting, startSuggestTransition] = useTransition();
  // true once a suggestion has been applied to the pick and not yet overridden
  // manually — while true, the suggest button stands in as the confirm action
  // for that pick, so one click to suggest + one click to confirm is enough.
  const [hasSuggestion, setHasSuggestion] = useState(false);
  const [suggestFailed, setSuggestFailed] = useState(false);
  const { contactId, applicationId } = pick;

  function handleSuggest() {
    setSuggestFailed(false);
    startSuggestTransition(async () => {
      const result = await suggestMatch(thread.id);
      if (!result.ok || (!result.contactId && !result.applicationId)) {
        setHasSuggestion(false);
        setSuggestFailed(true);
        return;
      }
      onPickChange({
        contactId: result.contactId ?? contactId,
        applicationId: result.applicationId ?? applicationId,
      });
      setHasSuggestion(true);
    });
  }

  // Once a contact is picked, narrow the application list down to just the
  // applications that contact is actually linked to (ApplicationContact) —
  // falls back to the full list when the contact has no linked applications.
  // ApplicationPicker ranks/searches within whichever set this resolves to.
  const linkedApplicationIds = contactId ? applicationIdsByContact[contactId] : undefined;
  const visibleApplications =
    linkedApplicationIds && linkedApplicationIds.length > 0
      ? applications.filter((a) => linkedApplicationIds.includes(a.id))
      : applications;

  // A manual pick change always overrides whatever suggestion was showing —
  // the suggest button reverts to its idle state rather than staying labeled
  // as confirming a suggestion that's no longer what's picked.
  function handleContactChange(newContactId: string) {
    setHasSuggestion(false);
    setSuggestFailed(false);
    const linked = newContactId ? applicationIdsByContact[newContactId] : undefined;
    const nextApplicationId =
      linked && linked.length > 0 && applicationId && !linked.includes(applicationId) ? "" : applicationId;
    onPickChange({ contactId: newContactId, applicationId: nextApplicationId });
  }

  function handleApplicationChange(newApplicationId: string) {
    setHasSuggestion(false);
    setSuggestFailed(false);
    onPickChange({ contactId, applicationId: newApplicationId });
  }

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
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 shrink-0" onClick={onToggleSelected}>
              <Checkbox
                checked={selected}
                onCheckedChange={onToggleSelected}
                aria-label="Select thread for bulk actions"
                className="pointer-events-none"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{thread.subject || "(no subject)"}</p>
              <p className="text-xs text-muted-foreground truncate">{thread.participants.join(", ")}</p>
              {thread.snippet && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{thread.snippet}</p>}
            </div>
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

        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
          <ContactPicker
            options={contactOptions}
            value={contactId}
            onChange={handleContactChange}
            participants={thread.participants}
            createContact={createContact}
          />
          <ApplicationPicker
            options={visibleApplications}
            participants={thread.participants}
            value={applicationId}
            onChange={handleApplicationChange}
          />
          {hasSuggestion ? (
            <Button type="button" size="sm" onClick={handleConfirm} disabled={isPending}>
              Confirm suggestion
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant={suggestFailed ? "ghost" : "outline"}
                className={suggestFailed ? "text-muted-foreground" : undefined}
                onClick={handleSuggest}
                disabled={isSuggesting || suggestFailed}
              >
                {isSuggesting ? "Suggesting…" : suggestFailed ? "No match found" : "Suggest match"}
              </Button>
              <Button type="button" size="sm" onClick={handleConfirm} disabled={isPending}>
                Confirm
              </Button>
            </>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={handleIgnore} disabled={isPending}>
            Ignore
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TriageList({
  threads,
  contactOptions,
  applications,
  applicationIdsByContact,
  confirmMatch,
  ignoreMatch,
  bulkConfirmMatches,
  bulkIgnoreMatches,
  createContact,
  suggestMatch,
}: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [picks, setPicks] = useState<Map<string, Pick>>(new Map());
  const [isBulkPending, startBulkTransition] = useTransition();

  function getPick(thread: TriageThread): Pick {
    return (
      picks.get(thread.id) ?? {
        contactId: thread.matchedContact?.id ?? "",
        applicationId: thread.matchedApplication?.id ?? "",
      }
    );
  }

  function setPick(threadId: string, pick: Pick) {
    setPicks((prev) => {
      const next = new Map(prev);
      next.set(threadId, pick);
      return next;
    });
  }

  function toggleSelected(threadId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  }

  function handleBulkConfirm() {
    const items = threads
      .filter((t) => selectedIds.has(t.id))
      .map((t) => {
        const pick = getPick(t);
        return {
          threadId: t.id,
          contactId: pick.contactId || null,
          applicationId: pick.applicationId || null,
        };
      });
    if (items.length === 0) return;
    startBulkTransition(async () => {
      await bulkConfirmMatches(items);
      setSelectedIds(new Set());
      router.refresh();
    });
  }

  function handleBulkIgnore() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      await bulkIgnoreMatches(ids);
      setSelectedIds(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2">
          <p className="text-sm text-muted-foreground">{selectedIds.size} selected</p>
          <div className="ml-auto flex gap-2">
            <Button type="button" size="sm" onClick={handleBulkConfirm} disabled={isBulkPending}>
              Confirm selected
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={handleBulkIgnore} disabled={isBulkPending}>
              Ignore selected
            </Button>
          </div>
        </div>
      )}
      {threads.map((thread) => (
        <TriageRow
          key={thread.id}
          thread={thread}
          contactOptions={contactOptions}
          applications={applications}
          applicationIdsByContact={applicationIdsByContact}
          confirmMatch={confirmMatch}
          ignoreMatch={ignoreMatch}
          createContact={createContact}
          suggestMatch={suggestMatch}
          selected={selectedIds.has(thread.id)}
          onToggleSelected={() => toggleSelected(thread.id)}
          pick={getPick(thread)}
          onPickChange={(pick) => setPick(thread.id, pick)}
        />
      ))}
    </div>
  );
}
