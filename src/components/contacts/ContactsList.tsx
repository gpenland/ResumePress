"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GRID_INSET } from "@/components/PageGrid";
import type { ContactWithCompany } from "@/lib/contacts";

type Props = {
  contacts: ContactWithCompany[];
  followUpDue?: boolean;
};

function matchesQuery(contact: ContactWithCompany, query: string): boolean {
  const haystacks = [contact.name, contact.company?.name, contact.title, contact.howMet, contact.notes, ...contact.tags];
  return haystacks.some((v) => v?.toLowerCase().includes(query));
}

// Same single-surface layout as the applications list: toolbar on top, rows
// below, all on one opaque panel over the page grid. No per-row delete —
// delete from the contact's own page.
export default function ContactsList({ contacts, followUpDue }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((c) => matchesQuery(c, query));
  }, [contacts, search]);

  return (
    <div className="border bg-card">
      <div className={cn("space-y-3 border-b py-4", GRID_INSET)}>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts..."
          aria-label="Search contacts"
        />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/contacts"
            aria-current={!followUpDue ? "page" : undefined}
            className={cn(buttonVariants({ variant: !followUpDue ? "default" : "outline", size: "sm" }))}
          >
            All
          </Link>
          <Link
            href="/contacts?followUp=due"
            aria-current={followUpDue ? "page" : undefined}
            className={cn(buttonVariants({ variant: followUpDue ? "default" : "outline", size: "sm" }))}
          >
            Follow-up due
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          {contacts.length === 0 ? (
            <>
              <p className="text-sm text-muted-foreground">{followUpDue ? "No follow-ups due" : "No contacts yet"}</p>
              {!followUpDue && (
                <Link href="/contacts/new" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Add your first contact
                </Link>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">No contacts match</p>
              <button type="button" onClick={() => setSearch("")} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Clear search
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="divide-y">
          {filtered.map((contact) => (
            <Link
              key={contact.id}
              href={`/contacts/${contact.id}`}
              className={cn("flex items-center justify-between gap-3 py-3 transition-colors hover:bg-muted/40", GRID_INSET)}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{contact.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[contact.title, contact.company?.name].filter(Boolean).join(" @ ")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {contact.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
