"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { buttonVariants } from "@/components/ui/button";
import { cn, nativeSelectClassName } from "@/lib/utils";
import EditableStatusBadge from "@/components/applications/EditableStatusBadge";
import DeleteItemButton from "@/components/DeleteItemButton";
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

type Props = {
  applications: ApplicationWithCompany[];
  status?: string;
  deleteApplication: (id: string) => Promise<void>;
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
  deleteApplication,
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

  return (
    <>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search applications..."
        aria-label="Search applications"
      />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/applications"
            className={cn(buttonVariants({ variant: !status ? "default" : "outline", size: "sm" }))}
          >
            All
          </Link>
          {APPLICATION_STATUSES.map((s) => (
            <Link
              key={s}
              href={`/applications?status=${encodeURIComponent(s)}`}
              className={cn(buttonVariants({ variant: status === s ? "default" : "outline", size: "sm" }))}
            >
              {s}
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          aria-label={`Sort by date, currently ${sortDir === "desc" ? "newest first" : "oldest first"}`}
        >
          Date {sortDir === "desc" ? "↓ Newest" : "↑ Oldest"}
        </button>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 flex-wrap rounded-lg border bg-muted/30 px-3 py-2">
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
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-center gap-3">
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
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
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
          </div>
          {filtered.map((app) => (
            <Card key={app.id} className="py-0 hover:bg-muted/30 transition-colors">
              <CardContent className="flex items-center gap-2 py-3 px-5">
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
                      {[
                        app.term,
                        app.location,
                        formatShortDate(app.appliedAt) && `Applied ${formatShortDate(app.appliedAt)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </Link>
                <div className="shrink-0">
                  <EditableStatusBadge applicationId={app.id} status={app.status} updateStatus={updateStatus} />
                </div>
                <DeleteItemButton
                  action={deleteApplication.bind(null, app.id)}
                  itemName={`${app.company.name} — ${app.roleTitle}`}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
