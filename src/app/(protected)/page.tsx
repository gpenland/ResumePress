export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { listApplicationsForUser, getApplicationPipelineStatsForUser } from "@/lib/applications";
import { listTriageThreadsForUser, getEmailSyncStatsForUser } from "@/lib/emailThreads";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { entryLabel } from "@/lib/entries";
import StatusBadge from "@/components/applications/StatusBadge";
import StatisticsPanel from "@/components/dashboard/StatisticsPanel";

export default async function HomePage() {
  const userId = await getUserId();

  const [recentResumes, recentEntries, recentApplications, triageThreads, pipelineStats, emailStats] = userId
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
        getApplicationPipelineStatsForUser(userId),
        getEmailSyncStatsForUser(userId),
      ])
    : [[], [], [], [], null, null];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">Your applications, resumes, and what&apos;s pending review</p>
      </div>

      {pipelineStats && emailStats && <StatisticsPanel pipeline={pipelineStats} email={emailStats} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent Applications</h2>
            <Link href="/applications" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              See all
            </Link>
          </div>
          {recentApplications.length === 0 ? (
            <EmptyState message="No applications yet" action={{ label: "Add your first application", href: "/applications/new" }} />
          ) : (
            <div className="space-y-2">
              {recentApplications.slice(0, 5).map((a) => (
                <Link key={a.id} href={`/applications/${a.id}`} className="block">
                  <Card className="hover:bg-muted/40 transition-colors cursor-pointer py-0">
                    <CardContent className="flex items-center justify-between py-3 px-4 gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.company.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.roleTitle}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Email</h2>
            <Link href="/email" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              See all
            </Link>
          </div>
          {triageThreads.length === 0 ? (
            <EmptyState message="Nothing pending triage" />
          ) : (
            <Link href="/email" className="block">
              <Card className="hover:bg-muted/40 transition-colors cursor-pointer py-0">
                <CardContent className="flex items-center justify-between py-3 px-4">
                  <span className="text-sm">
                    <Badge variant="secondary">{triageThreads.length}</Badge>{" "}
                    thread{triageThreads.length === 1 ? "" : "s"} awaiting review
                  </span>
                </CardContent>
              </Card>
            </Link>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent Resumes</h2>
            <Link href="/resumes/new" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              New resume
            </Link>
          </div>
          {recentResumes.length === 0 ? (
            <EmptyState message="No resumes yet" action={{ label: "Add your first resume", href: "/resumes/new" }} />
          ) : (
            <div className="space-y-2">
              {recentResumes.map((r) => (
                <Link key={r.id} href={`/resumes/${r.id}`} className="block">
                  <Card className="hover:bg-muted/40 transition-colors cursor-pointer py-0">
                    <CardContent className="flex items-center justify-between py-3 px-4">
                      <span className="text-sm font-medium">{r.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.updatedAt).toLocaleDateString()}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent Entries</h2>
            <Link href="/entries/new" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              New entry
            </Link>
          </div>
          {recentEntries.length === 0 ? (
            <EmptyState message="No entries yet" action={{ label: "Add your first entry", href: "/entries/new" }} />
          ) : (
            <div className="space-y-2">
              {recentEntries.map((e) => (
                <Link key={e.id} href={`/entries/${e.id}/edit`} className="block">
                  <Card className="hover:bg-muted/40 transition-colors cursor-pointer py-0">
                    <CardContent className="flex items-center justify-between py-3 px-4">
                      <div>
                        <p className="text-sm font-medium">{entryLabel(e)}</p>
                        <p className="text-xs text-muted-foreground">{e.category.name}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(e.updatedAt).toLocaleDateString()}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <Colophon />
    </div>
  );
}

// A small printer's note, the way a real document might carry one at the
// bottom of its last page — ties back to the "paper" design language.
// Rotates by day-of-year (not randomly) so it's stable within a day and
// needs no client state. Purely decorative; never the only content on the
// page, never blocks or shifts anything above it.
const COLOPHON_LINES = [
  "Typeset with care.",
  "You miss every shot you don't take.",
  "You are not great than your resume.",
  "No LaTeX was harmed in the making of this dashboard.",
  "We are all GMI",
  "Powered by AI slop.",
  "Loading AI B2B SaaS...",
];

function Colophon() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  const line = COLOPHON_LINES[dayOfYear % COLOPHON_LINES.length];
  return (
    <p className="text-center text-xs italic text-muted-foreground/60 font-heading pt-2">
      {line}
    </p>
  );
}

function EmptyState({ message, action }: { message: string; action?: { label: string; href: string } }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center py-10 text-center gap-3">
        <p className="text-sm text-muted-foreground">{message}</p>
        {action && (
          <Link href={action.href} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {action.label}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
