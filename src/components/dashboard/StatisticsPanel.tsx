import Link from "next/link";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { statusBarClass } from "@/lib/applicationsShared";
import type { ApplicationPipelineStats } from "@/lib/applications";
import type { EmailSyncStats } from "@/lib/emailThreads";
import CycleFilter from "@/components/applications/CycleFilter";

function StatTile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <Card className={cn("py-0 h-full", href && "hover:bg-muted/40 transition-colors cursor-pointer")}>
      <CardContent className="py-3 px-4">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-2xl font-semibold tracking-tight mt-1">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1 truncate">{hint}</p>}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
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
  if (!date) return "Never";
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "Just now";
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

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Statistics</h2>
        <CycleFilter options={cycleOptions} selected={selectedCycles} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatTile label="Total applications" value={pipeline.total} href="/applications" />
        <StatTile
          label="Active"
          value={pipeline.active}
          hint="not rejected/ghosted/withdrawn"
          href="/applications"
        />
        <StatTile
          label="Rejection rate"
          value={pipeline.rejectionRate === null ? "—" : `${Math.round(pipeline.rejectionRate * 100)}%`}
          hint={`${pipeline.rejections} rejection${pipeline.rejections === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Applied this week"
          value={pipeline.newThisWeek}
          hint={<WeekDelta thisWeek={pipeline.newThisWeek} lastWeek={pipeline.newLastWeek} />}
        />
        <StatTile label="Email needs review" value={email.needsReview} href="/email" />
        <StatTile
          label="Last synced"
          value={email.connected ? formatRelativeTime(email.lastSyncAt) : "Not connected"}
          href="/email"
        />
      </div>

      <Card className="py-0">
        <CardContent className="py-4 px-4">
          <p className="text-xs text-muted-foreground mb-3">Applications by status</p>
          {pipeline.byStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applications yet.</p>
          ) : (
            <div className="space-y-2">
              {pipeline.byStatus.map(({ status, count }) => (
                <div key={status} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 truncate text-muted-foreground">{status}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", statusBarClass(status))}
                      style={{ width: `${Math.max((count / maxStatusCount) * 100, 4)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
