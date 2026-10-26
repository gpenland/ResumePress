export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getContactForUser } from "@/lib/contacts";
import { listApplicationOptionsForUser } from "@/lib/interactions";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  const details: Array<[string, string]> = [
    ["Title", contact.title],
    ["Company", contact.company?.name ?? null],
    ["Phone", contact.phone],
    ["How met", contact.howMet],
  ].filter(([, v]) => v) as Array<[string, string]>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">{contact.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
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
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/contacts/${contact.id}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Edit
          </Link>
          <DeleteItemButton action={deleteContact.bind(null, contact.id)} itemName={contact.name} />
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

      {contact.tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {contact.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {contact.notes && (
        <Card>
          <CardContent className="py-5">
            <p className="text-xs text-muted-foreground mb-2">Notes</p>
            <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Applications</p>
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
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Interactions</p>
        <LogInteractionForm contactId={contact.id} logInteraction={logInteraction} />
        <InteractionTimeline
          interactions={contact.interactions}
          deleteInteraction={deleteInteraction}
        />
      </div>
    </div>
  );
}
