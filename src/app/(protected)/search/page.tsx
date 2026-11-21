export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { globalSearch } from "@/lib/search";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import PageGrid, { GRID_INSET } from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";
import { Panel, PanelRow } from "@/components/Panel";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const userId = await requireUserId();
  const results = q ? await globalSearch(userId, q) : null;
  const totalCount = results ? results.applications.length + results.contacts.length + results.interactions.length : 0;

  return (
    <PageGrid
      header={
        <PageHeader
          eyebrow="Search"
          title={q ? `“${q}”` : "Search"}
          description={
            q ? `${totalCount} result${totalCount === 1 ? "" : "s"}` : "Search applications, contacts, and interactions"
          }
        />
      }
    >
      <div className="space-y-8 lg:w-3/4">
        <Panel padded>
          <form action="/search" method="GET" className="flex gap-2">
            <Input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search applications, contacts, interactions…"
              aria-label="Search"
              autoFocus
            />
            <Button type="submit">Search</Button>
          </form>
        </Panel>

        {results && totalCount === 0 && (
          <Panel padded>
            <p className="text-sm text-muted-foreground">No results.</p>
          </Panel>
        )}

        {results && results.applications.length > 0 && (
          <Panel title="Applications" badge={results.applications.length}>
            {results.applications.map((a) => (
              <PanelRow key={a.id} href={`/applications/${a.id}`} title={a.companyName} subtitle={a.roleTitle} />
            ))}
          </Panel>
        )}

        {results && results.contacts.length > 0 && (
          <Panel title="Contacts" badge={results.contacts.length}>
            {results.contacts.map((c) => (
              <PanelRow key={c.id} href={`/contacts/${c.id}`} title={c.name} subtitle={c.companyName ?? undefined} />
            ))}
          </Panel>
        )}

        {results && results.interactions.length > 0 && (
          <Panel title="Interactions" badge={results.interactions.length}>
            {results.interactions.map((i) => {
              const href = i.contactId
                ? `/contacts/${i.contactId}`
                : i.applicationId
                  ? `/applications/${i.applicationId}`
                  : null;
              const content = (
                <span className="min-w-0 text-sm">
                  <span className="font-medium">{i.type}</span>
                  <span className="text-muted-foreground">: {i.summary}</span>
                </span>
              );
              return (
                <div key={i.id} className={cn("flex items-center justify-between gap-3 py-2.5", GRID_INSET)}>
                  {href ? (
                    <Link href={href} className="min-w-0 hover:underline underline-offset-2">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                  {i.emailThreadGmailUrl && (
                    <a
                      href={i.emailThreadGmailUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs underline hover:text-foreground"
                    >
                      Open email
                    </a>
                  )}
                </div>
              );
            })}
          </Panel>
        )}
      </div>
    </PageGrid>
  );
}
