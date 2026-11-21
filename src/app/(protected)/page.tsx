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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { entryLabel } from "@/lib/entries";
import StatusBadge from "@/components/applications/StatusBadge";
import StatisticsPanel from "@/components/dashboard/StatisticsPanel";
import PageGrid, { GRID_INSET } from "@/components/PageGrid";
import { Panel, PanelRow, PanelEmpty } from "@/components/dashboard/DashboardPanel";
import PageHeader from "@/components/PageHeader";
import { decodeHtmlEntities } from "@/lib/emailThreadsShared";
import { formatShortDate } from "@/lib/dateFormat";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  const { cycle } = await searchParams;
  const userId = await getUserId();
  const cycles = parseCycleSearchParam(cycle);

  const [recentResumes, recentEntries, recentApplications, triageThreads, pipelineStats, emailStats, cycleOptions] = userId
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
      ])
    : [[], [], [], [], null, null, []];

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

      {/* items-start: each panel is as tall as its own content, so a short
          list never leaves a dead block next to a longer one. */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
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
          action={{ label: triageThreads.length > 0 ? "Review" : "See all", href: "/email" }}
        >
          {triageThreads.length === 0 ? (
            <PanelEmpty message="Nothing pending triage" />
          ) : (
            <>
              {triageThreads.slice(0, 4).map((t) => (
                <PanelRow
                  key={t.id}
                  href="/email"
                  title={decodeHtmlEntities(t.subject || "(no subject)")}
                  subtitle={t.participants.join(", ")}
                  meta={<span className="text-xs text-muted-foreground">{formatShortDate(t.lastMessageAt)}</span>}
                />
              ))}
              <p className={cn("pt-1 pb-3 text-xs text-muted-foreground", GRID_INSET)}>
                {triageThreads.length} thread{triageThreads.length === 1 ? "" : "s"} awaiting review
              </p>
            </>
          )}
        </Panel>

        <Panel title="Recent resumes" action={{ label: "New resume", href: "/resumes/new" }}>
          {recentResumes.length === 0 ? (
            <PanelEmpty message="No resumes yet" action={{ label: "Add your first resume", href: "/resumes/new" }} />
          ) : (
            recentResumes.map((r) => (
              <PanelRow
                key={r.id}
                href={`/resumes/${r.id}`}
                title={r.name}
                meta={<span className="text-xs text-muted-foreground">{new Date(r.updatedAt).toLocaleDateString()}</span>}
              />
            ))
          )}
        </Panel>

        <Panel title="Recent entries" action={{ label: "New entry", href: "/entries/new" }}>
          {recentEntries.length === 0 ? (
            <PanelEmpty message="No entries yet" action={{ label: "Add your first entry", href: "/entries/new" }} />
          ) : (
            recentEntries.map((e) => (
              <PanelRow
                key={e.id}
                href={`/entries/${e.id}/edit`}
                title={entryLabel(e)}
                subtitle={e.category.name}
                meta={<span className="text-xs text-muted-foreground">{new Date(e.updatedAt).toLocaleDateString()}</span>}
              />
            ))
          )}
        </Panel>
      </div>
    </PageGrid>
  );
}
