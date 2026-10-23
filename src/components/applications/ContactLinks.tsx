"use client";

import { useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type LinkedContact = { contactId: string; role: string; name: string };
export type ContactOption = { id: string; name: string };

type Props = {
  applicationId: string;
  linked: LinkedContact[];
  contactOptions: ContactOption[];
  link: (contactId: string, applicationId: string, role: string) => Promise<void>;
  unlink: (contactId: string, applicationId: string) => Promise<void>;
};

// Mirrors src/components/contacts/ApplicationLinks.tsx from the other side of
// the same ApplicationContact relation — part of Phase 3's cross-linking UI
// (PLAN.md §6: "contacts on applications and vice versa").
export default function ContactLinks({ applicationId, linked, contactOptions, link, unlink }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const linkedIds = new Set(linked.map((l) => l.contactId));
  const available = contactOptions.filter((c) => !linkedIds.has(c.id));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(formRef.current!);
    const contactId = data.get("contactId") as string;
    const role = (data.get("role") as string) || "Other";
    if (!contactId) return;
    startTransition(async () => {
      await link(contactId, applicationId, role);
      formRef.current?.reset();
      router.refresh();
    });
  }

  function handleUnlink(contactId: string) {
    startTransition(async () => {
      await unlink(contactId, applicationId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {linked.length === 0 ? (
        <p className="text-muted-foreground text-sm px-1">No contacts linked.</p>
      ) : (
        <div className="space-y-1.5">
          {linked.map((l) => (
            <div key={l.contactId} className="flex items-center gap-2 text-sm px-1">
              <Link href={`/contacts/${l.contactId}`} className="hover:underline">
                {l.name}
              </Link>
              <span className="text-muted-foreground text-xs">({l.role})</span>
              <button
                type="button"
                onClick={() => handleUnlink(l.contactId)}
                disabled={isPending}
                className="text-xs text-muted-foreground hover:text-destructive ml-auto"
              >
                Unlink
              </button>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 pt-1">
          <select
            name="contactId"
            required
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Link a contact…
            </option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Input name="role" placeholder="Role (e.g. Recruiter)" className="w-44 h-8" />
          <Button type="submit" size="sm" variant="outline" disabled={isPending}>
            Link
          </Button>
        </form>
      )}
    </div>
  );
}
