export const dynamic = "force-dynamic";

import Link from "next/link";
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
  deleteApplication,
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

  const [applications, cycleOptions] = userId
    ? await Promise.all([
        listApplicationsForUser(userId, { status: isKanban || isFlow ? undefined : status, cycles }),
        listApplicationCycleOptionsForUser(userId),
      ])
    : [[], []];
  const statusFlow = isFlow && userId ? await getApplicationStatusFlowForUser(userId, { cycles }) : [];

  const viewTab = (label: string, active: boolean, query: Record<string, string>) => (
    <Link
      href={{ pathname: "/applications", query }}
      aria-current={active ? "page" : undefined}
      className={cn(buttonVariants({ variant: active ? "default" : "ghost", size: "sm" }))}
    >
      {label}
    </Link>
  );

  return (
    <PageGrid
      header={
        <PageHeader
          eyebrow="Pipeline"
          title="Applications"
          description={`${applications.length} total`}
          actions={
            <>
              <CycleFilter options={cycleOptions} selected={cycles} />
              <div className="flex border bg-card p-0.5">
                {viewTab("List", !isKanban && !isFlow, { ...(status ? { status } : {}), cycle: resolvedCycle })}
                {viewTab("Kanban", isKanban, { view: "kanban", cycle: resolvedCycle })}
                {viewTab("Flow", isFlow, { view: "flow", cycle: resolvedCycle })}
              </div>
              <Link href="/applications/import" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Import
              </Link>
              <Link href="/applications/new" className={cn(buttonVariants())}>New application</Link>
            </>
          }
        />
      }
    >
      {isFlow ? (
        <ApplicationStatusSankey links={statusFlow} />
      ) : isKanban ? (
        <ApplicationsKanban applications={applications} updateStatus={updateApplicationStatus} />
      ) : (
        <ApplicationsList
          applications={applications}
          status={status}
          cycle={resolvedCycle}
          deleteApplication={deleteApplication}
          updateStatus={updateApplicationStatus}
          bulkUpdateStatus={bulkUpdateApplicationStatus}
          bulkDelete={bulkDeleteApplications}
        />
      )}
    </PageGrid>
  );
}
