"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GripVertical } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn, nativeSelectClassName } from "@/lib/utils";
import { APPLICATION_STATUSES, type ApplicationWithCompany } from "@/lib/applicationsShared";
import { formatMonthDay } from "@/lib/dateFormat";
import StatusDot from "@/components/applications/StatusDot";
import { GRID_INSET } from "@/components/PageGrid";

type Props = {
  applications: ApplicationWithCompany[];
  updateStatus: (id: string, status: string) => Promise<void>;
};

// Each column is a quarter of the board, so up to four columns land exactly
// on PageGrid's lines; more than four scroll horizontally at the same width
// (and at a 16rem floor on narrow screens). Columns carry their own left
// border so each sits on its grid line; only the last one closes on the
// right, widened 1px so that border sits on the next grid line too rather
// than beside it.
function columnStyle(isLast: boolean): React.CSSProperties {
  return { width: isLast ? "max(16rem, calc(25% + 1px))" : "max(16rem, 25%)" };
}

export default function ApplicationsKanban({ applications, updateStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  // Empty columns are hidden by default (issue #17), but while a card is
  // being dragged we show every status so there's always somewhere to drop
  // it — including a status with nothing in it yet.
  const [isDragging, setIsDragging] = useState(false);

  function handleDrop(status: string, e: React.DragEvent) {
    e.preventDefault();
    setDragOverStatus(null);
    const id = e.dataTransfer.getData("text/application-id");
    if (!id) return;
    startTransition(async () => {
      await updateStatus(id, status);
      router.refresh();
    });
  }

  function handleMoveTo(applicationId: string, status: string) {
    startTransition(async () => {
      await updateStatus(applicationId, status);
      router.refresh();
    });
  }

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 border bg-card py-16 text-center">
        <p className="text-muted-foreground text-sm">No applications yet</p>
        <Link href="/applications/new" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Add your first application
        </Link>
      </div>
    );
  }

  const visibleStatuses = APPLICATION_STATUSES.filter(
    (status) => isDragging || applications.some((a) => a.status === status)
  );

  return (
    <div className="overflow-x-auto" aria-busy={isPending}>
      {/* Columns size to their own content (no dead space under a short
          column) — except mid-drag, when they stretch so every column is a
          full-height drop target. */}
      <div className={cn("flex min-w-full", isDragging ? "items-stretch" : "items-start")}>
        {visibleStatuses.map((status, i) => {
          const columnApps = applications.filter((a) => a.status === status);
          const isLast = i === visibleStatuses.length - 1;
          return (
            <div
              key={status}
              style={columnStyle(isLast)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStatus(status);
              }}
              onDragLeave={() => setDragOverStatus((s) => (s === status ? null : s))}
              onDrop={(e) => handleDrop(status, e)}
              className={cn(
                "shrink-0 border-y border-l bg-card min-h-32 transition-colors",
                isLast && "border-r",
                dragOverStatus === status && "bg-primary/5 ring-1 ring-inset ring-primary"
              )}
            >
              <div className={cn("flex items-center justify-between gap-2 border-b py-3", GRID_INSET)}>
                <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <StatusDot status={status} />
                  <span className="truncate">{status}</span>
                </p>
                <span className="text-xs tabular-nums text-muted-foreground">{columnApps.length}</span>
              </div>
              <div className="py-1">
                {columnApps.map((app) => (
                  <div
                    key={app.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/application-id", app.id);
                      setIsDragging(true);
                    }}
                    onDragEnd={() => setIsDragging(false)}
                    className={cn("group relative space-y-2 py-3 transition-colors hover:bg-muted/50 cursor-grab active:cursor-grabbing", GRID_INSET)}
                  >
                    {/* Sits in the row's left inset, so titles keep the shared text edge. */}
                    <GripVertical
                      aria-hidden="true"
                      className="absolute left-0.5 top-3.5 size-3.5 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground lg:left-1.5"
                    />
                    <Link href={`/applications/${app.id}`} className="block min-w-0">
                      <p className="truncate text-sm font-medium group-hover:underline underline-offset-2">{app.company.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{app.roleTitle}</p>
                    </Link>
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-xs text-muted-foreground">
                        {[app.term, app.appliedAt && formatMonthDay(app.appliedAt)].filter(Boolean).join(" · ")}
                      </p>
                      {/* Keyboard-operable alternative to drag-and-drop — found missing by the Phase 4 audit. */}
                      <select
                        value={app.status}
                        onChange={(e) => handleMoveTo(app.id, e.target.value)}
                        aria-label={`Move ${app.company.name} — ${app.roleTitle} to status`}
                        className={cn(nativeSelectClassName("sm"), "w-auto shrink-0 bg-card")}
                      >
                        {APPLICATION_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                {columnApps.length === 0 && (
                  <p className={cn("py-6 text-center text-xs text-muted-foreground", GRID_INSET)}>Drop here</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
