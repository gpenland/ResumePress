export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import {
  listApplicationsForUser,
  getApplicationPipelineStatsForUser,
  listApplicationCycleOptionsForUser,
} from "@/lib/applications";
import { parseCycleSearchParam } from "@/lib/recruitingCycleShared";
import { listTriageThreadsForUser, getEmailSyncStatsForUser } from "@/lib/emailThreads";
import { getGmailConnectionStatus } from "@/lib/gmailAccount";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { entryLabel } from "@/lib/entries";
import StatusBadge from "@/components/applications/StatusBadge";
import StatisticsPanel from "@/components/dashboard/StatisticsPanel";
import PageGrid, { GRID_INSET } from "@/components/PageGrid";
import { Panel, PanelRow, PanelEmpty } from "@/components/Panel";
import PageHeader from "@/components/PageHeader";
import { decodeHtmlEntities, otherParticipants } from "@/lib/emailThreadsShared";
import { formatShortDate } from "@/lib/dateFormat";

function DateMeta({ date }: { date: Date | null }) {
  return <span className="text-xs text-muted-foreground">{formatShortDate(date)}</span>;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  const { cycle } = await searchParams;
  const userId = await getUserId();
  const cycles = parseCycleSearchParam(cycle);

  const [recentResumes, recentEntries, recentApplications, triageThreads, pipelineStats, emailStats, cycleOptions, gmail] = userId
    ? await Promise.all([
        prisma.resume.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 5 }),
        prisma.entry.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          take: 5,
          include: { category: true },
        }),
        listApplicationsForUser(userId),
        listTriageThreadsForUser(userId),
        getApplicationPipelineStatsForUser(userId, { cycles }),
        getEmailSyncStatsForUser(userId),
        listApplicationCycleOptionsForUser(userId),
        getGmailConnectionStatus(userId),
      ])
    : [[], [], [], [], null, null, [], null];
  const selfEmail = gmail?.connected ? gmail.email : null;

  return (
    <PageGrid
      header={
        <PageHeader
          eyebrow="Overview"
          title="Dashboard"
          description="Your applications, resumes, and what's pending review"
          actions={
            <Link href="/applications/new" className={cn(buttonVariants())}>
              New application
            </Link>
          }
        />
      }
    >
      {pipelineStats && emailStats && (
        <StatisticsPanel pipeline={pipelineStats} email={emailStats} cycleOptions={cycleOptions} selectedCycles={cycles} />
      )}

      {/* Two independent column stacks rather than a 2×2 grid: a short panel
          is followed directly by the next one in its column instead of
          leaving a hole beside a taller neighbour. Tracker on the left,
          resume builder on the right. */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          <Panel title="Recent applications" action={{ label: "See all", href: "/applications" }}>
            {recentApplications.length === 0 ? (
              <PanelEmpty message="No applications yet" action={{ label: "Add your first application", href: "/applications/new" }} />
            ) : (
              recentApplications.slice(0, 5).map((a) => (
                <PanelRow key={a.id} href={`/applications/${a.id}`} title={a.company.name} subtitle={a.roleTitle} meta={<StatusBadge status={a.status} />} />
              ))
            )}
          </Panel>

          <Panel
            title="Email"
            badge={triageThreads.length > 0 ? triageThreads.length : undefined}
            action={{ label: "See all", href: "/email" }}
          >
            {triageThreads.length === 0 ? (
              <PanelEmpty message="Nothing pending review" />
            ) : (
              <>
                {triageThreads.slice(0, 4).map((t) => (
                  <PanelRow
                    key={t.id}
                    href="/email"
                    title={decodeHtmlEntities(t.subject || "(no subject)")}
                    subtitle={otherParticipants(t.participants, selfEmail).join(", ")}
                    meta={<DateMeta date={t.lastMessageAt} />}
                  />
                ))}
                <p className={cn("pt-1 pb-3 text-xs text-muted-foreground", GRID_INSET)}>
                  {triageThreads.length} thread{triageThreads.length === 1 ? "" : "s"} awaiting review
                </p>
              </>
            )}
          </Panel>
        </div>

        <div className="space-y-8">
          <Panel title="Recent entries" action={{ label: "See all", href: "/entries" }}>
            {recentEntries.length === 0 ? (
              <PanelEmpty message="No entries yet" action={{ label: "Add your first entry", href: "/entries/new" }} />
            ) : (
              recentEntries.map((e) => (
                <PanelRow
                  key={e.id}
                  href={`/entries/${e.id}/edit`}
                  title={entryLabel(e)}
                  subtitle={e.category.name}
                  meta={<DateMeta date={e.updatedAt} />}
                />
              ))
            )}
          </Panel>

          <Panel title="Recent resumes" action={{ label: "See all", href: "/resumes" }}>
            {recentResumes.length === 0 ? (
              <PanelEmpty message="No resumes yet" action={{ label: "Add your first resume", href: "/resumes/new" }} />
            ) : (
              recentResumes.map((r) => (
                <PanelRow key={r.id} href={`/resumes/${r.id}`} title={r.name} meta={<DateMeta date={r.updatedAt} />} />
              ))
            )}
          </Panel>
        </div>
      </div>
    </PageGrid>
  );
}
