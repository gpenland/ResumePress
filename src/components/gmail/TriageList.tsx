"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

type Props = {
  threads: TriageThread[];
  contactOptions: { id: string; name: string }[];
  applicationOptions: { id: string; label: string }[];
  applicationIdsByContact: Record<string, string[]>;
  confirmMatch: (threadId: string, contactId: string | null, applicationId: string | null) => Promise<void>;
  ignoreMatch: (threadId: string) => Promise<void>;
  createContact: CreateContact;
};

type RowProps = {
  thread: TriageThread;
  contactOptions: { id: string; name: string }[];
  applicationOptions: { id: string; label: string }[];
  applicationIdsByContact: Record<string, string[]>;
  confirmMatch: (threadId: string, contactId: string | null, applicationId: string | null) => Promise<void>;
  ignoreMatch: (threadId: string) => Promise<void>;
  createContact: CreateContact;
};

function NewContactDialog({
  thread,
  createContact,
  onCreated,
}: {
  thread: TriageThread;
  createContact: CreateContact;
  onCreated: (contact: { id: string; name: string }) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(thread.participants[0] ?? "");
  const [isPending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = nameRef.current?.value.trim();
    if (!name) return;
    startTransition(async () => {
      const contact = await createContact(name, email || null);
      onCreated(contact);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        New contact
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>New contact</AlertDialogTitle>
          </AlertDialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input ref={nameRef} name="name" placeholder="Name" required autoFocus />
            {thread.participants.length > 1 ? (
              <select
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email"
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {thread.participants.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-muted-foreground px-0.5">{email || "No email found on this thread"}</p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
              <AlertDialogAction type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TriageRow({ thread, contactOptions, applicationOptions, applicationIdsByContact, confirmMatch, ignoreMatch, createContact }: RowProps) {
  const router = useRouter();
  const [contactId, setContactId] = useState(thread.matchedContact?.id ?? "");
  const [applicationId, setApplicationId] = useState(thread.matchedApplication?.id ?? "");
  const [isPending, startTransition] = useTransition();

  // Once a contact is picked, narrow the application list down to just the
  // applications that contact is actually linked to (ApplicationContact) —
  // falls back to the full list when the contact has no linked applications.
  const linkedApplicationIds = contactId ? applicationIdsByContact[contactId] : undefined;
  const visibleApplicationOptions =
    linkedApplicationIds && linkedApplicationIds.length > 0
      ? applicationOptions.filter((a) => linkedApplicationIds.includes(a.id))
      : applicationOptions;

  function handleContactChange(newContactId: string) {
    setContactId(newContactId);
    const linked = newContactId ? applicationIdsByContact[newContactId] : undefined;
    if (linked && linked.length > 0 && applicationId && !linked.includes(applicationId)) {
      setApplicationId("");
    }
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
            onChange={(e) => handleContactChange(e.target.value)}
            aria-label="Contact"
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
            aria-label="Application"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">No application</option>
            {visibleApplicationOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
          <Button type="button" size="sm" onClick={handleConfirm} disabled={isPending}>
            Confirm
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={handleIgnore} disabled={isPending}>
            Ignore
          </Button>
          <NewContactDialog
            thread={thread}
            createContact={createContact}
            onCreated={(contact) => setContactId(contact.id)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function TriageList({ threads, contactOptions, applicationOptions, applicationIdsByContact, confirmMatch, ignoreMatch, createContact }: Props) {
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
          applicationIdsByContact={applicationIdsByContact}
          confirmMatch={confirmMatch}
          ignoreMatch={ignoreMatch}
          createContact={createContact}
        />
      ))}
    </div>
  );
}
