"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, GripVertical, MoreHorizontal } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { APPLICATION_STATUSES, type ApplicationWithCompany } from "@/lib/applicationsShared";
import { formatShortDate } from "@/lib/dateFormat";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import StatusDot from "@/components/applications/StatusDot";

type Props = {
  applications: ApplicationWithCompany[];
  updateStatus: (id: string, status: string) => Promise<void>;
};

// Columns share the board's width equally, so every status with anything
// in it is on screen at desktop width — all seven fit at the page's full
// width (six columns used to scroll two of them out of sight). Below a
// 10rem floor per column the board scrolls sideways instead, with a fade
// and a "more" cue on the right edge so the hidden columns aren't a secret.
const COLUMN_MIN_WIDTH = "10rem";
// Narrower than the page's 24px text inset: columns no longer sit one per
// grid column, and card text needs the room.
const CARD_INSET = "px-4";

export default function ApplicationsKanban({ applications, updateStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  // Empty columns are hidden by default (issue #17), but while a card is
  // being dragged we show every status so there's always somewhere to drop
  // it — including a status with nothing in it yet.
  const [isDragging, setIsDragging] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [applications.length]);

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
    <div className="relative" aria-busy={isPending}>
    <div ref={scrollerRef} className="overflow-x-auto">
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
              style={{ flex: `1 0 ${COLUMN_MIN_WIDTH}` }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStatus(status);
              }}
              onDragLeave={() => setDragOverStatus((s) => (s === status ? null : s))}
              onDrop={(e) => handleDrop(status, e)}
              className={cn(
                "min-w-0 border-y border-l bg-card min-h-32 transition-colors",
                isLast && "border-r",
                dragOverStatus === status && "bg-primary/5 ring-1 ring-inset ring-primary"
              )}
            >
              <div className={cn("flex items-center justify-between gap-2 border-b py-3", CARD_INSET)}>
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
                    className={cn("group relative space-y-2 py-3 transition-colors hover:bg-muted/50 cursor-grab active:cursor-grabbing", CARD_INSET)}
                  >
                    {/* Sits in the row's left inset, so titles keep the shared text edge. */}
                    <GripVertical
                      aria-hidden="true"
                      className="absolute left-0.5 top-3.5 size-3.5 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground"
                    />
                    <Link href={`/applications/${app.id}`} className="block min-w-0">
                      <p className="truncate text-sm font-medium group-hover:underline underline-offset-2">{app.company.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{app.roleTitle}</p>
                    </Link>
                    <div className="flex items-center justify-between gap-2">
                      {/* Breaks between the term and the date, never inside the date. */}
                      <p className="min-w-0 text-xs text-muted-foreground">
                        {[app.term, formatShortDate(app.appliedAt)]
                          .filter(Boolean)
                          .map((part, i) => (
                            <Fragment key={i}>
                              {i > 0 && " · "}
                              <span className="whitespace-nowrap">{part}</span>
                            </Fragment>
                          ))}
                      </p>
                      {/* Keyboard-operable alternative to drag-and-drop (found
                          missing by the Phase 4 audit) — a small menu rather
                          than a full status dropdown on every card, which
                          repeated the column's own status and squeezed the
                          date into an ellipsis. */}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="-mr-1 shrink-0 text-muted-foreground"
                              aria-label={`Move ${app.company.name} — ${app.roleTitle} to another status`}
                            >
                              <MoreHorizontal />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>Move to</DropdownMenuLabel>
                            <DropdownMenuRadioGroup value={app.status} onValueChange={(v) => handleMoveTo(app.id, v as string)}>
                              {APPLICATION_STATUSES.map((s) => (
                                <DropdownMenuRadioItem key={s} value={s}>
                                  <StatusDot status={s} />
                                  {s}
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
                {columnApps.length === 0 && (
                  <p className={cn("py-6 text-center text-xs text-muted-foreground", CARD_INSET)}>Drop here</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
      {canScrollRight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 flex w-16 items-start justify-end bg-gradient-to-l from-background to-transparent pt-3 pr-1"
        >
          <ChevronRight className="size-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
