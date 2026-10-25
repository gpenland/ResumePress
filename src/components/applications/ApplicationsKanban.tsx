"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { APPLICATION_STATUSES, type ApplicationWithCompany } from "@/lib/applicationsShared";

type Props = {
  applications: ApplicationWithCompany[];
  updateStatus: (id: string, status: string) => Promise<void>;
};

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
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center py-16 text-center gap-3">
          <p className="text-muted-foreground text-sm">No applications yet</p>
          <Link href="/applications/new" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Add your first application
          </Link>
        </CardContent>
      </Card>
    );
  }

  const visibleStatuses = APPLICATION_STATUSES.filter(
    (status) => isDragging || applications.some((a) => a.status === status)
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" aria-busy={isPending}>
      {visibleStatuses.map((status) => {
        const columnApps = applications.filter((a) => a.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStatus(status);
            }}
            onDragLeave={() => setDragOverStatus((s) => (s === status ? null : s))}
            onDrop={(e) => handleDrop(status, e)}
            className={`w-64 shrink-0 rounded-lg border bg-muted/20 p-2 space-y-2 min-h-[120px] transition-colors ${
              dragOverStatus === status ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between px-1.5 py-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{status}</p>
              <span className="text-xs text-muted-foreground">{columnApps.length}</span>
            </div>
            {columnApps.map((app) => (
              <Card
                key={app.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/application-id", app.id);
                  setIsDragging(true);
                }}
                onDragEnd={() => setIsDragging(false)}
                className="py-0 cursor-grab active:cursor-grabbing hover:bg-muted/40 transition-colors"
              >
                <CardContent className="p-3 space-y-2">
                  <Link href={`/applications/${app.id}`} className="block min-w-0">
                    <p className="font-medium text-sm truncate">{app.company.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{app.roleTitle}</p>
                    {app.term && <p className="text-xs text-muted-foreground mt-1">{app.term}</p>}
                  </Link>
                  {/* Keyboard-operable alternative to drag-and-drop — found missing by the Phase 4 audit. */}
                  <select
                    value={app.status}
                    onChange={(e) => handleMoveTo(app.id, e.target.value)}
                    aria-label={`Move ${app.roleTitle} to status`}
                    className="w-full h-7 rounded-md border border-input bg-transparent px-1.5 text-xs"
                  >
                    {APPLICATION_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })}
    </div>
  );
}
