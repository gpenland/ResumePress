"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DeleteItemButton from "@/components/DeleteItemButton";
import type { ContactWithCompany } from "@/lib/contacts";

type Props = {
  contacts: ContactWithCompany[];
  followUpDue?: boolean;
  deleteContact: (id: string) => Promise<void>;
};

function matchesQuery(contact: ContactWithCompany, query: string): boolean {
  const haystacks = [contact.name, contact.company?.name, contact.title, contact.howMet, contact.notes, ...contact.tags];
  return haystacks.some((v) => v?.toLowerCase().includes(query));
}

export default function ContactsList({ contacts, followUpDue, deleteContact }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((c) => matchesQuery(c, query));
  }, [contacts, search]);

  return (
    <>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search contacts..."
        aria-label="Search contacts"
      />

      <div className="flex gap-2 flex-wrap">
        <Link href="/contacts" className={cn(buttonVariants({ variant: !followUpDue ? "default" : "outline", size: "sm" }))}>
          All
        </Link>
        <Link
          href="/contacts?followUp=due"
          className={cn(buttonVariants({ variant: followUpDue ? "default" : "outline", size: "sm" }))}
        >
          Follow-up due
        </Link>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-center gap-3">
            {contacts.length === 0 ? (
              <>
                <p className="text-muted-foreground text-sm">No contacts yet</p>
                <Link href="/contacts/new" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Add your first contact
                </Link>
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">No contacts match</p>
                <button type="button" onClick={() => setSearch("")} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Clear search
                </button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((contact) => (
            <Card key={contact.id} className="py-0 hover:bg-muted/30 transition-colors">
              <CardContent className="flex items-center gap-2 py-3 px-5">
                <Link href={`/contacts/${contact.id}`} className="flex items-center justify-between flex-1 min-w-0 gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{contact.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[contact.title, contact.company?.name].filter(Boolean).join(" @ ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {contact.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </Link>
                <DeleteItemButton action={deleteContact.bind(null, contact.id)} itemName={contact.name} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
