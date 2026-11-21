export const dynamic = "force-dynamic";

import Link from "next/link";
import { Upload } from "lucide-react";
import { getUserId } from "@/lib/auth";
import {
  listApplicationsForUser,
  getApplicationStatusFlowForUser,
  listApplicationCycleOptionsForUser,
} from "@/lib/applications";
import { parseCycleSearchParam, serializeCycleSearchParam } from "@/lib/recruitingCycleShared";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  updateApplicationStatus,
  bulkUpdateApplicationStatus,
  bulkDeleteApplications,
} from "./actions";
import ApplicationsList from "@/components/applications/ApplicationsList";
import ApplicationsKanban from "@/components/applications/ApplicationsKanban";
import ApplicationStatusSankey from "@/components/applications/ApplicationStatusSankey";
import CycleFilter from "@/components/applications/CycleFilter";
import PageGrid from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";
import SegmentedLinks from "@/components/SegmentedLinks";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string; cycle?: string }>;
}) {
  const { status, view, cycle } = await searchParams;
  const userId = await getUserId();
  const isKanban = view === "kanban";
  const isFlow = view === "flow";
  const cycles = parseCycleSearchParam(cycle);
  // Resolved rather than the raw (possibly absent) `cycle` param, so every
  // link below carries forward whatever cycle is actually in effect —
  // including the "all cycles" and the implicit-current-cycle-by-default
  // cases — instead of silently resetting to the default on navigation.
  const resolvedCycle = serializeCycleSearchParam(cycles);

  // Fetched unfiltered by status so the list's status filters can show a
  // count each; the status filter itself is applied below.
  const [cycleApplications, cycleOptions] = userId
    ? await Promise.all([
        listApplicationsForUser(userId, { cycles }),
        listApplicationCycleOptionsForUser(userId),
      ])
    : [[], []];
  const statusFlow = isFlow && userId ? await getApplicationStatusFlowForUser(userId, { cycles }) : [];

  const statusCounts: Record<string, number> = {};
  for (const a of cycleApplications) statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
  const listApplications =
    !isKanban && !isFlow && status ? cycleApplications.filter((a) => a.status === status) : cycleApplications;

  // The per-row "Cycle 2026-2027" note only earns its place when the list
  // mixes cycles; with one cycle selected it's the same on every row.
  const showCycleOnRows = cycles === undefined || cycles.length > 1;

  return (
    <PageGrid
      header={
        <PageHeader
          eyebrow="Pipeline"
          title="Applications"
          description={`${cycleApplications.length} total`}
          actions={
            <>
              {/* Two groups, so on a phone they wrap into two even rows
                  instead of scattering one control per line. */}
              <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
                <CycleFilter options={cycleOptions} selected={cycles} />
                <SegmentedLinks
                  label="View"
                  items={[
                    {
                      label: "List",
                      active: !isKanban && !isFlow,
                      href: { pathname: "/applications", query: { ...(status ? { status } : {}), cycle: resolvedCycle } },
                    },
                    { label: "Kanban", active: isKanban, href: { pathname: "/applications", query: { view: "kanban", cycle: resolvedCycle } } },
                    { label: "Flow", active: isFlow, href: { pathname: "/applications", query: { view: "flow", cycle: resolvedCycle } } },
                  ]}
                />
              </div>
              <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
                <Link href="/applications/import" className={cn(buttonVariants({ variant: "outline" }))}>
                  <Upload aria-hidden="true" />
                  Import
                </Link>
                <Link href="/applications/new" className={cn(buttonVariants())}>New application</Link>
              </div>
            </>
          }
        />
      }
    >
      {isFlow ? (
        <ApplicationStatusSankey links={statusFlow} />
      ) : isKanban ? (
        <ApplicationsKanban applications={cycleApplications} updateStatus={updateApplicationStatus} />
      ) : (
        <ApplicationsList
          applications={listApplications}
          status={status}
          cycle={resolvedCycle}
          statusCounts={statusCounts}
          totalCount={cycleApplications.length}
          showCycle={showCycleOnRows}
          updateStatus={updateApplicationStatus}
          bulkUpdateStatus={bulkUpdateApplicationStatus}
          bulkDelete={bulkDeleteApplications}
        />
      )}
    </PageGrid>
  );
}
