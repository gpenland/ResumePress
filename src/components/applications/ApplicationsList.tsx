"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GRID_INSET } from "@/components/PageGrid";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { buttonVariants } from "@/components/ui/button";
import { cn, nativeSelectClassName } from "@/lib/utils";
import EditableStatusBadge from "@/components/applications/EditableStatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { APPLICATION_STATUSES, formatShortDate, type ApplicationWithCompany } from "@/lib/applicationsShared";
import { cycleForApplication, cycleShortLabel } from "@/lib/recruitingCycleShared";

type Props = {
  applications: ApplicationWithCompany[];
  status?: string;
  // The resolved `?cycle=` value (never the possibly-absent raw param — see
  // applications/page.tsx) carried into these status-filter links so
  // switching status doesn't silently reset the cycle filter back to its
  // current-cycle default (GitHub issue #106 follow-up).
  cycle: string;
  /** Count per status across the whole selected cycle, for the filter buttons. */
  statusCounts: Record<string, number>;
  totalCount: number;
  /** Whether rows show their computed cycle — only useful when several cycles are listed. */
  showCycle: boolean;
  updateStatus: (id: string, status: string) => Promise<void>;
  bulkUpdateStatus: (ids: string[], status: string) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;
};

function matchesQuery(app: ApplicationWithCompany, query: string): boolean {
  const haystacks = [app.company.name, app.roleTitle, app.term, app.location, app.notes];
  return haystacks.some((v) => v?.toLowerCase().includes(query));
}

function sortKey(app: ApplicationWithCompany): number {
  const date = app.appliedAt ?? app.createdAt;
  return new Date(date).getTime();
}

export default function ApplicationsList({
  applications,
  status,
  cycle,
  statusCounts,
  totalCount,
  showCycle,
  updateStatus,
  bulkUpdateStatus,
  bulkDelete,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = query ? applications.filter((a) => matchesQuery(a, query)) : applications;
    return [...base].sort((a, b) =>
      sortDir === "asc" ? sortKey(a) - sortKey(b) : sortKey(b) - sortKey(a)
    );
  }, [applications, search, sortDir]);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const a of filtered) next.delete(a.id);
      } else {
        for (const a of filtered) next.add(a.id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function handleBulkStatusChange(next: string) {
    if (!next || selectedIds.length === 0) return;
    startTransition(async () => {
      await bulkUpdateStatus(selectedIds, next);
      clearSelection();
      router.refresh();
    });
  }

  function handleBulkDelete() {
    startTransition(async () => {
      await bulkDelete(selectedIds);
      setConfirmingDelete(false);
      clearSelection();
      router.refresh();
    });
  }

  // One surface — toolbar, selection bar and rows — so nothing in the list
  // view sits on bare background over the page grid.
  return (
    <div className="border bg-card">
      <div className={cn("space-y-3 border-b py-4", GRID_INSET)}>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search applications..."
          aria-label="Search applications"
        />

        {/* One scrollable row rather than wrapping: on a phone the filters
            would otherwise stack three rows deep above the list. The
            negative margin lets it scroll to the panel edge, where a fade
            shows there's more. */}
        <div className="relative -mx-4 lg:-mx-6">
          <div className="flex gap-2 overflow-x-auto px-4 lg:px-6 [scrollbar-width:none]">
            <FilterLink href={`/applications?cycle=${encodeURIComponent(cycle)}`} active={!status} label="All" count={totalCount} />
            {APPLICATION_STATUSES.map((s) => (
              <FilterLink
                key={s}
                href={`/applications?status=${encodeURIComponent(s)}&cycle=${encodeURIComponent(cycle)}`}
                active={status === s}
                label={s}
                count={statusCounts[s] ?? 0}
              />
            ))}
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent lg:hidden" />
        </div>
      </div>

      {selected.size > 0 && (
        <div className={cn("flex items-center gap-3 flex-wrap border-b bg-muted/40 py-2", GRID_INSET)}>
          <span className="text-sm font-medium">{selected.size} selected</span>
          <select
            defaultValue=""
            onChange={(e) => handleBulkStatusChange(e.target.value)}
            disabled={isPending}
            aria-label="Bulk change status"
            className={nativeSelectClassName()}
          >
            <option value="" disabled>
              Change status to…
            </option>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={isPending}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-destructive hover:text-destructive")}
          >
            Delete selected
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={isPending}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Clear selection
          </button>
        </div>
      )}

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selected.size} application{selected.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.stopPropagation(); handleBulkDelete(); }}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center gap-3">
            {applications.length === 0 ? (
              <>
                <p className="text-muted-foreground text-sm">No applications yet</p>
                <Link href="/applications/new" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Add your first application
                </Link>
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">No applications match your search</p>
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Clear search
                </button>
              </>
            )}
        </div>
      ) : (
        <div className="divide-y">
          <div className={cn("flex items-center gap-2 py-2", GRID_INSET)}>
            <div onClick={toggleAllFiltered} className="cursor-pointer p-0.5">
              <Checkbox
                checked={allFilteredSelected}
                onCheckedChange={toggleAllFiltered}
                className="pointer-events-none"
                aria-label={allFilteredSelected ? "Deselect all" : "Select all"}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {allFilteredSelected ? "Deselect all" : "Select all"}
            </span>
            {/* Sort lives on the list's own header row, leaving the filter
                row the full width. */}
            <button
              type="button"
              onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "ml-auto -mr-2.5 text-muted-foreground")}
              aria-label={`Sort by date, currently ${sortDir === "desc" ? "newest first" : "oldest first"}`}
            >
              {sortDir === "desc" ? "Newest first ↓" : "Oldest first ↑"}
            </button>
          </div>
          {filtered.map((app) => (
            <div key={app.id} className={cn("flex items-center gap-2 py-3 hover:bg-muted/40 transition-colors", GRID_INSET)}>
                <div
                  onClick={(e) => { e.stopPropagation(); toggleOne(app.id); }}
                  className="shrink-0 p-1"
                >
                  <Checkbox
                    checked={selected.has(app.id)}
                    onCheckedChange={() => toggleOne(app.id)}
                    className="pointer-events-none"
                    aria-label={`Select ${app.company.name} — ${app.roleTitle}`}
                  />
                </div>
                <Link href={`/applications/${app.id}`} className="flex-1 min-w-0">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {app.company.name} <span className="text-muted-foreground font-normal">— {app.roleTitle}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(() => {
                        const appCycle = cycleForApplication(app.term, app.appliedAt);
                        const parts = [
                          app.term,
                          app.location,
                          formatShortDate(app.appliedAt) && `Applied ${formatShortDate(app.appliedAt)}`,
                          // Surfaces what the cycle filter computed for this row
                          // (issue #106 follow-up) — only when several cycles are
                          // listed; otherwise it's identical on every row.
                          showCycle && appCycle !== null && `Cycle ${cycleShortLabel(appCycle)}`,
                        ].filter(Boolean) as string[];
                        // Each piece is unbreakable, so a narrow screen wraps
                        // between pieces rather than mid-date.
                        return parts.map((part, i) => (
                          <Fragment key={i}>
                            {i > 0 && " · "}
                            <span className="whitespace-nowrap">{part}</span>
                          </Fragment>
                        ));
                      })()}
                    </p>
                  </div>
                </Link>
                {/* No per-row delete: it sat next to the status on every row.
                    Delete from the application's own page, or select rows
                    and use "Delete selected". */}
                <div className="shrink-0">
                  <EditableStatusBadge applicationId={app.id} status={app.status} updateStatus={updateStatus} />
                </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterLink({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(buttonVariants({ variant: active ? "default" : "outline", size: "sm" }), "shrink-0 gap-1.5")}
    >
      {label}
      <span className={cn("tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>{count}</span>
    </Link>
  );
}
