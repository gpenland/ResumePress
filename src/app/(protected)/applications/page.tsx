export const dynamic = "force-dynamic";

import Link from "next/link";
import { getUserId } from "@/lib/auth";
import { listApplicationsForUser, getApplicationStatusFlowForUser } from "@/lib/applications";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteApplication, updateApplicationStatus } from "./actions";
import ApplicationsList from "@/components/applications/ApplicationsList";
import ApplicationsKanban from "@/components/applications/ApplicationsKanban";
import ApplicationStatusSankey from "@/components/applications/ApplicationStatusSankey";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string }>;
}) {
  const { status, view } = await searchParams;
  const userId = await getUserId();
  const isKanban = view === "kanban";
  const isFlow = view === "flow";

  const applications = userId
    ? await listApplicationsForUser(userId, { status: isKanban || isFlow ? undefined : status })
    : [];
  const statusFlow = isFlow && userId ? await getApplicationStatusFlowForUser(userId) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
          <p className="text-muted-foreground text-sm mt-1">{applications.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            <Link
              href={{ pathname: "/applications", query: status ? { status } : {} }}
              className={cn(buttonVariants({ variant: !isKanban && !isFlow ? "default" : "ghost", size: "sm" }))}
            >
              List
            </Link>
            <Link
              href={{ pathname: "/applications", query: { view: "kanban" } }}
              className={cn(buttonVariants({ variant: isKanban ? "default" : "ghost", size: "sm" }))}
            >
              Kanban
            </Link>
            <Link
              href={{ pathname: "/applications", query: { view: "flow" } }}
              className={cn(buttonVariants({ variant: isFlow ? "default" : "ghost", size: "sm" }))}
            >
              Flow
            </Link>
          </div>
          <Link href="/applications/import" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Import
          </Link>
          <Link href="/applications/new" className={cn(buttonVariants())}>New Application</Link>
        </div>
      </div>

      {isFlow ? (
        <ApplicationStatusSankey links={statusFlow} />
      ) : isKanban ? (
        <ApplicationsKanban applications={applications} updateStatus={updateApplicationStatus} />
      ) : (
        <ApplicationsList
          applications={applications}
          status={status}
          deleteApplication={deleteApplication}
          updateStatus={updateApplicationStatus}
        />
      )}
    </div>
  );
}
