"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Category, Entry } from "@prisma/client";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GRID_INSET } from "@/components/PageGrid";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { entryLabel } from "@/lib/entries";
import CloneItemButton from "@/components/CloneItemButton";

type EntryWithCategory = Entry & { category: Category };

type Props = {
  categories: Category[];
  entries: EntryWithCategory[];
  category?: string;
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

export default function EntryList({ categories, entries, category, cloneEntry }: Props) {
  const [search, setSearch] = useState("");

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => matchesQuery(entry, query));
  }, [entries, search]);

  // Same single-surface layout as the applications and contacts lists. No
  // per-row delete — delete from the entry's own edit page.
  return (
    <div className="border bg-card">
      <div className={cn("space-y-3 border-b py-4", GRID_INSET)}>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search entries..."
          aria-label="Search entries"
        />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/entries"
            aria-current={!category ? "page" : undefined}
            className={cn(buttonVariants({ variant: !category ? "default" : "outline", size: "sm" }))}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/entries?category=${cat.slug}`}
              aria-current={category === cat.slug ? "page" : undefined}
              className={cn(buttonVariants({ variant: category === cat.slug ? "default" : "outline", size: "sm" }))}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          {entries.length === 0 ? (
            <>
              <p className="text-sm text-muted-foreground">No entries yet</p>
              <Link href="/entries/new" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Add your first entry
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">No entries match your search</p>
              <button type="button" onClick={() => setSearch("")} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Clear search
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="divide-y">
          {filteredEntries.map((entry) => (
            <div key={entry.id} className={cn("flex items-center gap-2 py-3 transition-colors hover:bg-muted/40", GRID_INSET)}>
              <Link href={`/entries/${entry.id}/edit`} className="flex min-w-0 flex-1 items-center justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{entryLabel(entry)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[entry.organization, entry.location, entry.startDate && `${entry.startDate}${entry.endDate ? ` – ${entry.endDate}` : ""}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-2">
                  {entry.bullets.length > 0 && (
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {entry.bullets.length} bullet{entry.bullets.length === 1 ? "" : "s"}
                    </span>
                  )}
                  <Badge variant="secondary">{entry.category.name}</Badge>
                </div>
              </Link>
              <CloneItemButton action={cloneEntry.bind(null, entry.id)} itemName={entryLabel(entry)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
