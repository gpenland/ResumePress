export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireUserId } from "@/lib/auth";
import { getApplicationForUser } from "@/lib/applications";
import { formatShortDate } from "@/lib/applicationsShared";
import { cycleForApplication, cycleLabel } from "@/lib/recruitingCycleShared";
import { listResumesForUser } from "@/lib/resumes";
import { listContactOptionsForUser } from "@/lib/contacts";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import PageGrid from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";
import { Panel, FactList } from "@/components/Panel";
import EditableStatusBadge from "@/components/applications/EditableStatusBadge";
import SuggestStatusButton from "@/components/applications/SuggestStatusButton";
import ResumeSection from "@/components/applications/ResumeSection";
import ContactLinks from "@/components/applications/ContactLinks";
import StatusHistoryList from "@/components/applications/StatusHistoryList";
import InteractionTimeline from "@/components/contacts/InteractionTimeline";
import LogInteractionForm from "@/components/contacts/LogInteractionForm";
import DeleteItemButton from "@/components/DeleteItemButton";
import {
  deleteApplication,
  logApplicationUpdate,
  setApplicationHistoryNote,
  deleteApplicationStatusHistoryEntry,
  updateApplicationStatus,
  suggestApplicationStatus,
} from "../actions";
import { attachResumeToApplication, detachResumeFromApplication } from "../resumeActions";
import {
  linkContactToApplication,
  unlinkContactFromApplication,
  logInteraction,
  deleteInteraction,
} from "@/app/(protected)/contacts/actions";

const SECTIONS = [
  { id: "resume", label: "Resume" },
  { id: "contacts", label: "Contacts" },
  { id: "interactions", label: "Interactions" },
  { id: "status-history", label: "Status history" },
];

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const [application, resumes, contactOptions] = await Promise.all([
    getApplicationForUser(userId, id),
    listResumesForUser(userId),
    listContactOptionsForUser(userId),
  ]);
  if (!application) notFound();

  // Surfaces the cycle the filter dropdown actually computed for this
  // application — otherwise there's no way to tell, from the UI, whether a
  // term like "Summer 2027" parsed the way you'd expect (GitHub issue #106
  // follow-up: visibility into the computed cycle, not just the filter).
  const cycle = cycleForApplication(application.term, application.appliedAt);

  const facts = (
    [
      ["Applied", formatShortDate(application.appliedAt)],
      ["Term", application.term],
      ["Recruiting cycle", cycle !== null ? cycleLabel(cycle) : null],
      ["Location", application.location],
      ["Source", application.source],
    ] as Array<[string, string | null]>
  ).filter((f): f is [string, string] => Boolean(f[1]));

  return (
    <PageGrid
      header={
        <PageHeader
          back={{ href: "/applications", label: "Applications" }}
          // The company leads, as it does in the list ("Brex — SWE") and on
          // the dashboard; the role is the subtitle.
          title={application.company.name}
          description={
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-base text-foreground">{application.roleTitle}</span>
              <EditableStatusBadge applicationId={application.id} status={application.status} updateStatus={updateApplicationStatus} />
              {application.postingUrl && (
                <a
                  href={application.postingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline"
                >
                  Job posting
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              )}
            </div>
          }
          actions={
            <>
              <SuggestStatusButton
                applicationId={application.id}
                suggestStatus={suggestApplicationStatus}
                updateStatus={updateApplicationStatus}
              />
              <Link href={`/applications/${application.id}/edit`} className={cn(buttonVariants({ variant: "outline" }))}>
                Edit
              </Link>
              <DeleteItemButton
                label="Delete"
                action={deleteApplication.bind(null, application.id)}
                itemName={`${application.roleTitle} @ ${application.company.name}`}
              />
            </>
          }
        />
      }
    >
      {/* Three grid columns of content, one of facts — the facts sit beside
          the work instead of in a mostly-empty card above it. */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-4">
        <aside className="space-y-8 lg:sticky lg:top-20 lg:order-last">
          <Panel title="Details" padded>
            {facts.length > 0 ? (
              <FactList facts={facts} />
            ) : (
              <p className="text-sm text-muted-foreground">No details yet.</p>
            )}
            <nav aria-label="On this page" className="mt-5 hidden space-y-1 border-t pt-4 lg:block">
              {SECTIONS.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="block text-sm text-muted-foreground transition-colors hover:text-foreground">
                  {s.label}
                </a>
              ))}
            </nav>
          </Panel>
        </aside>

        <div className="space-y-8 lg:col-span-3">
          {application.notes && (
            <Panel title="Notes" padded>
              <p className="text-sm whitespace-pre-wrap">{application.notes}</p>
            </Panel>
          )}

          <Panel id="resume" title="Resume" padded>
            <ResumeSection
              applicationId={application.id}
              resume={application.resume ? { id: application.resume.id, name: application.resume.name } : null}
              snapshot={application.resumeSnapshot ? { id: application.resumeSnapshot.id, createdAt: application.resumeSnapshot.createdAt } : null}
              resumes={resumes.map((r) => ({ id: r.id, name: r.name }))}
              attach={attachResumeToApplication}
              detach={detachResumeFromApplication}
            />
          </Panel>

          <Panel id="contacts" title="Contacts" padded>
            <ContactLinks
              applicationId={application.id}
              linked={application.contacts.map((ac) => ({
                contactId: ac.contactId,
                role: ac.role,
                name: ac.contact.name,
              }))}
              contactOptions={contactOptions}
              link={linkContactToApplication}
              unlink={unlinkContactFromApplication}
            />
          </Panel>

          <Panel id="interactions" title="Interactions" padded>
            <div className="space-y-4">
              <LogInteractionForm applicationId={application.id} logInteraction={logInteraction} />
              <InteractionTimeline interactions={application.interactions} deleteInteraction={deleteInteraction} />
            </div>
          </Panel>

          <Panel id="status-history" title="Status history" padded>
            <StatusHistoryList
              applicationId={application.id}
              history={application.statusHistory}
              logUpdate={logApplicationUpdate}
              setNote={setApplicationHistoryNote}
              deleteEntry={deleteApplicationStatusHistoryEntry}
            />
          </Panel>
        </div>
      </div>
    </PageGrid>
  );
}
