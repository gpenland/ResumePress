import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusBarClass } from "@/lib/applicationsShared";
import type { ApplicationPipelineStats } from "@/lib/applications";
import type { EmailSyncStats } from "@/lib/emailThreads";
import CycleFilter from "@/components/applications/CycleFilter";
import StatusDot from "@/components/applications/StatusDot";
import { Eyebrow } from "@/components/PageHeader";
import { GRID_INSET } from "@/components/PageGrid";
import { serializeCycleSearchParam } from "@/lib/recruitingCycleShared";

// Every cell sits in one `gap-px` grid over a border-colored background, so
// neighbouring cells share a single 1px rule and, at lg, each column edge
// lands on a PageGrid line. Rows are always full (4 + 3/1) so no empty cell
// ever shows the border color through.
const CELL = cn("bg-card py-4", GRID_INSET);

function StatTile({
  label,
  value,
  hint,
  href,
  emphasize = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  emphasize?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <Eyebrow className={cn("sm:truncate", emphasize && "text-primary")}>{label}</Eyebrow>
      <p className={cn("mt-2 text-3xl font-light tracking-tight tabular-nums sm:text-4xl", emphasize && "text-primary")}>{value}</p>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground sm:truncate">{hint}</div>}
    </>
  );
  return href ? (
    <Link href={href} className={cn(CELL, "block min-w-0 transition-colors hover:bg-muted/50", className)}>
      {body}
    </Link>
  ) : (
    <div className={cn(CELL, "min-w-0", className)}>{body}</div>
  );
}

function WeekDelta({ thisWeek, lastWeek }: { thisWeek: number; lastWeek: number }) {
  if (thisWeek === 0 && lastWeek === 0) return null;
  const delta = thisWeek - lastWeek;
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5">
        <Minus className="size-3" /> same as last week
      </span>
    );
  }
  const Icon = delta > 0 ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex items-center gap-0.5">
      <Icon className="size-3" />
      {Math.abs(delta)} vs last week
    </span>
  );
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return "never";
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function StatisticsPanel({
  pipeline,
  email,
  cycleOptions,
  selectedCycles,
}: {
  pipeline: ApplicationPipelineStats;
  email: EmailSyncStats;
  cycleOptions: number[];
  selectedCycles: number[] | undefined;
}) {
  const maxStatusCount = Math.max(1, ...pipeline.byStatus.map((s) => s.count));
  // Carried into the "Total applications"/"Active" tiles below so clicking
  // through to the applications list doesn't silently reset the cycle
  // filter back to its current-cycle default (GitHub issue #106 follow-up).
  const applicationsHref = `/applications?cycle=${encodeURIComponent(serializeCycleSearchParam(selectedCycles))}`;
  const needsReview = email.needsReview > 0;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        {/* No opaque label boxes here (unlike PageHeader): both sit well inside
            their grid columns, and a box would just cut a gap in the grid line. */}
        <h2 className="text-2xl font-heading lg:px-6">Statistics</h2>
        <div className="lg:px-6">
          <CycleFilter options={cycleOptions} selected={selectedCycles} />
        </div>
      </div>

      {/* Two tiles per row even on a phone, so the four headline numbers fit
          on one screen instead of stacking into a long scroll. */}
      <div className="grid grid-cols-2 gap-px overflow-hidden border bg-border lg:grid-cols-4">
        {/* The one actionable number leads, in the brand color when there's
            something to do. Last-synced rides along as its hint rather than
            taking a tile of its own. */}
        <StatTile
          label="Email needs review"
          value={email.needsReview}
          href="/email"
          emphasize={needsReview}
          hint={
            email.connected ? (
              <span className="inline-flex items-center gap-1">
                {needsReview && (
                  <>
                    <span className="font-medium text-primary">Review</span>
                    <ArrowRight className="size-3 text-primary" />
                    <span aria-hidden="true">·</span>
                  </>
                )}
                Last synced {formatRelativeTime(email.lastSyncAt)}
              </span>
            ) : (
              "Gmail not connected"
            )
          }
        />
        <StatTile label="Total applications" value={pipeline.total} href={applicationsHref} />
        <StatTile label="Active" value={pipeline.active} hint="not rejected/ghosted/withdrawn" href={applicationsHref} />
        <StatTile
          label="Applied this week"
          value={pipeline.newThisWeek}
          hint={<WeekDelta thisWeek={pipeline.newThisWeek} lastWeek={pipeline.newLastWeek} />}
        />

        <div className={cn(CELL, "col-span-2 min-w-0 lg:col-span-3")}>
          <Eyebrow>Applications by status</Eyebrow>
          {pipeline.byStatus.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No applications in this cycle yet.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {pipeline.byStatus.map(({ status, count }) => (
                <div key={status} className="flex items-center gap-3 text-sm">
                  <span className="flex w-28 shrink-0 items-center gap-2 truncate text-muted-foreground sm:w-32">
                    <StatusDot status={status} />
                    <span className="truncate">{status}</span>
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden bg-muted">
                    <div
                      className={cn("h-full", statusBarClass(status))}
                      style={{ width: `${Math.max((count / maxStatusCount) * 100, 4)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <StatTile
          className="col-span-2 lg:col-span-1"
          label="Rejection rate"
          value={pipeline.rejectionRate === null ? "—" : `${Math.round(pipeline.rejectionRate * 100)}%`}
          hint={`${pipeline.rejections} rejection${pipeline.rejections === 1 ? "" : "s"}`}
        />
      </div>
    </section>
  );
}
