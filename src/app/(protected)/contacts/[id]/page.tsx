export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getContactForUser } from "@/lib/contacts";
import { listApplicationOptionsForUser } from "@/lib/interactions";
import { buttonVariants } from "@/components/ui/button";
import PageGrid from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";
import { Panel, FactList } from "@/components/Panel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import DeleteItemButton from "@/components/DeleteItemButton";
import InteractionTimeline from "@/components/contacts/InteractionTimeline";
import LogInteractionForm from "@/components/contacts/LogInteractionForm";
import ApplicationLinks from "@/components/contacts/ApplicationLinks";
import {
  deleteContact,
  logInteraction,
  deleteInteraction,
  linkContactToApplication,
  unlinkContactFromApplication,
} from "../actions";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const [contact, applicationOptions] = await Promise.all([
    getContactForUser(userId, id),
    listApplicationOptionsForUser(userId),
  ]);
  if (!contact) notFound();

  const facts = (
    [
      ["Title", contact.title],
      ["Company", contact.company?.name ?? null],
      ["Phone", contact.phone],
      ["How met", contact.howMet],
    ] as Array<[string, string | null]>
  ).filter((f): f is [string, string] => Boolean(f[1]));

  return (
    <PageGrid
      header={
        <PageHeader
          back={{ href: "/contacts", label: "Contacts" }}
          title={contact.name}
          description={
            (contact.emails.length > 0 || contact.linkedinUrl) && (
              <p>
                {contact.emails.map((email, idx) => (
                  <span key={email}>
                    {idx > 0 && ", "}
                    <a href={`mailto:${email}`} className="underline hover:text-foreground">
                      {email}
                    </a>
                  </span>
                ))}
                {contact.linkedinUrl && (
                  <>
                    {contact.emails.length > 0 && " · "}
                    <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                      LinkedIn
                    </a>
                  </>
                )}
              </p>
            )
          }
          actions={
            <>
              <Link href={`/contacts/${contact.id}/edit`} className={cn(buttonVariants({ variant: "outline" }))}>
                Edit
              </Link>
              <DeleteItemButton label="Delete" action={deleteContact.bind(null, contact.id)} itemName={contact.name} />
            </>
          }
        />
      }
    >
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-4">
        <aside className="space-y-8 lg:sticky lg:top-20 lg:order-last">
          <Panel title="Details" padded>
            {facts.length > 0 ? <FactList facts={facts} /> : <p className="text-sm text-muted-foreground">No details yet.</p>}
            {contact.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5 border-t pt-4">
                {contact.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </Panel>
        </aside>

        <div className="space-y-8 lg:col-span-3">
          {contact.notes && (
            <Panel title="Notes" padded>
              <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
            </Panel>
          )}

          <Panel title="Applications" padded>
            <ApplicationLinks
              contactId={contact.id}
              linked={contact.applications.map((ac) => ({
                applicationId: ac.applicationId,
                role: ac.role,
                roleTitle: ac.application.roleTitle,
                companyName: ac.application.company.name,
              }))}
              applicationOptions={applicationOptions}
              link={linkContactToApplication}
              unlink={unlinkContactFromApplication}
            />
          </Panel>

          <Panel title="Interactions" padded>
            <div className="space-y-4">
              <LogInteractionForm contactId={contact.id} logInteraction={logInteraction} />
              <InteractionTimeline interactions={contact.interactions} deleteInteraction={deleteInteraction} />
            </div>
          </Panel>
        </div>
      </div>
    </PageGrid>
  );
}
