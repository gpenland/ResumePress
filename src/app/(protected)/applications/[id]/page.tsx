export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getApplicationForUser } from "@/lib/applications";
import { listResumesForUser } from "@/lib/resumes";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import StatusBadge from "@/components/applications/StatusBadge";
import ResumeSection from "@/components/applications/ResumeSection";
import StatusHistoryList from "@/components/applications/StatusHistoryList";
import DeleteItemButton from "@/components/DeleteItemButton";
import { deleteApplication, logApplicationUpdate, setApplicationHistoryNote } from "../actions";
import { attachResumeToApplication, detachResumeFromApplication } from "../resumeActions";

function formatDate(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const [application, resumes] = await Promise.all([
    getApplicationForUser(userId, id),
    listResumesForUser(userId),
  ]);
  if (!application) notFound();

  const details: Array<[string, string | null]> = [
    ["Term", application.term],
    ["Location", application.location],
    ["Applied", formatDate(application.appliedAt)],
    ["Source", application.source],
  ].filter(([, v]) => v) as Array<[string, string]>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{application.roleTitle}</h1>
            <StatusBadge status={application.status} />
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {application.company.name}
            {application.postingUrl && (
              <>
                {" · "}
                <a href={application.postingUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                  Posting
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/applications/${application.id}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Edit
          </Link>
          <DeleteItemButton
            action={deleteApplication.bind(null, application.id)}
            itemName={`${application.roleTitle} @ ${application.company.name}`}
          />
        </div>
      </div>

      {details.length > 0 && (
        <Card>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-5">
            {details.map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium mt-0.5">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {application.notes && (
        <Card>
          <CardContent className="py-5">
            <p className="text-xs text-muted-foreground mb-2">Notes</p>
            <p className="text-sm whitespace-pre-wrap">{application.notes}</p>
          </CardContent>
        </Card>
      )}

      <ResumeSection
        applicationId={application.id}
        resume={application.resume ? { id: application.resume.id, name: application.resume.name } : null}
        resumes={resumes.map((r) => ({ id: r.id, name: r.name }))}
        attach={attachResumeToApplication}
        detach={detachResumeFromApplication}
      />

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Status History
        </p>
        <StatusHistoryList
          applicationId={application.id}
          history={application.statusHistory}
          logUpdate={logApplicationUpdate}
          setNote={setApplicationHistoryNote}
        />
      </div>
    </div>
  );
}
