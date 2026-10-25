"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import EditableStatusBadge from "@/components/applications/EditableStatusBadge";
import DeleteItemButton from "@/components/DeleteItemButton";
import { APPLICATION_STATUSES, formatShortDate, type ApplicationWithCompany } from "@/lib/applicationsShared";

type Props = {
  applications: ApplicationWithCompany[];
  status?: string;
  deleteApplication: (id: string) => Promise<void>;
  updateStatus: (id: string, status: string) => Promise<void>;
};

function matchesQuery(app: ApplicationWithCompany, query: string): boolean {
  const haystacks = [app.company.name, app.roleTitle, app.term, app.location, app.notes];
  return haystacks.some((v) => v?.toLowerCase().includes(query));
}

function sortKey(app: ApplicationWithCompany): number {
  const date = app.appliedAt ?? app.createdAt;
  return new Date(date).getTime();
}

export default function ApplicationsList({ applications, status, deleteApplication, updateStatus }: Props) {
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = query ? applications.filter((a) => matchesQuery(a, query)) : applications;
    return [...base].sort((a, b) =>
      sortDir === "asc" ? sortKey(a) - sortKey(b) : sortKey(b) - sortKey(a)
    );
  }, [applications, search, sortDir]);

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
          {filtered.map((app) => (
            <Card key={app.id} className="py-0 hover:bg-muted/30 transition-colors">
              <CardContent className="flex items-center gap-2 py-3 px-5">
                <Link href={`/applications/${app.id}`} className="flex-1 min-w-0">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {app.company.name} <span className="text-muted-foreground font-normal">— {app.roleTitle}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[app.term, app.location].filter(Boolean).join(" · ")}
                      {formatShortDate(app.appliedAt) && (
                        <span className="ml-2">Applied {formatShortDate(app.appliedAt)}</span>
                      )}
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
