"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Category, Entry } from "@prisma/client";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { entryLabel } from "@/lib/entries";
import DeleteItemButton from "@/components/DeleteItemButton";
import CloneItemButton from "@/components/CloneItemButton";

type EntryWithCategory = Entry & { category: Category };

type Props = {
  categories: Category[];
  entries: EntryWithCategory[];
  category?: string;
  deleteEntry: (id: string) => Promise<void>;
  cloneEntry: (id: string) => Promise<void>;
};

function matchesQuery(entry: EntryWithCategory, query: string): boolean {
  const haystacks = [
    entry.title,
    entry.displayTitle,
    entry.organization,
    entry.description,
    ...entry.bullets,
    ...entry.tags,
  ];
  return haystacks.some((value) => value?.toLowerCase().includes(query));
}

export default function EntryList({ categories, entries, category, deleteEntry, cloneEntry }: Props) {
  const [search, setSearch] = useState("");

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => matchesQuery(entry, query));
  }, [entries, search]);

  return (
    <>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search entries..."
        aria-label="Search entries"
      />

      <div className="flex gap-2 flex-wrap">
        <Link
          href="/entries"
          className={cn(buttonVariants({ variant: !category ? "default" : "outline", size: "sm" }))}
        >
          All
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/entries?category=${cat.slug}`}
            className={cn(buttonVariants({ variant: category === cat.slug ? "default" : "outline", size: "sm" }))}
          >
            {cat.name}
          </Link>
        ))}
      </div>

      {filteredEntries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-center gap-3">
            {entries.length === 0 ? (
              <>
                <p className="text-muted-foreground text-sm">No entries found</p>
                <Link href="/entries/new" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Create your first entry
                </Link>
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">No entries match your search</p>
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Clear search
                </button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredEntries.map((entry) => (
            <Card key={entry.id} className="py-0 hover:bg-muted/30 transition-colors">
              <CardContent className="flex items-center gap-2 py-3 px-5">
                <Link
                  href={`/entries/${entry.id}/edit`}
                  className="flex items-center justify-between flex-1 min-w-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{entryLabel(entry)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[entry.organization, entry.location].filter(Boolean).join(" · ")}
                      {entry.startDate && (
                        <span className="ml-2">
                          {entry.startDate}{entry.endDate ? ` – ${entry.endDate}` : ""}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <Badge variant="secondary">{entry.category.name}</Badge>
                    {entry.bullets.length > 0 && (
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {entry.bullets.length} bullets
                      </span>
                    )}
                  </div>
                </Link>
                <CloneItemButton
                  action={cloneEntry.bind(null, entry.id)}
                  itemName={entryLabel(entry)}
                />
                <DeleteItemButton
                  action={deleteEntry.bind(null, entry.id)}
                  itemName={entryLabel(entry)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
