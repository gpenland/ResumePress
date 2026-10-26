export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { globalSearch } from "@/lib/search";
import { Card, CardContent } from "@/components/ui/card";

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
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Search</h1>
        {q && <p className="text-muted-foreground text-sm mt-1">{totalCount} result(s) for &ldquo;{q}&rdquo;</p>}
      </div>

      {!results ? (
        <p className="text-muted-foreground text-sm">Search applications, contacts, and interactions from the box above.</p>
      ) : totalCount === 0 ? (
        <p className="text-muted-foreground text-sm">No results.</p>
      ) : (
        <div className="space-y-6">
          {results.applications.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Applications</p>
              <div className="space-y-1.5">
                {results.applications.map((a) => (
                  <Card key={a.id} className="py-0 hover:bg-muted/30 transition-colors">
                    <CardContent className="py-3 px-4">
                      <Link href={`/applications/${a.id}`} className="text-sm hover:underline">
                        {a.roleTitle} <span className="text-muted-foreground">@ {a.companyName}</span>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {results.contacts.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Contacts</p>
              <div className="space-y-1.5">
                {results.contacts.map((c) => (
                  <Card key={c.id} className="py-0 hover:bg-muted/30 transition-colors">
                    <CardContent className="py-3 px-4">
                      <Link href={`/contacts/${c.id}`} className="text-sm hover:underline">
                        {c.name}
                        {c.companyName && <span className="text-muted-foreground"> @ {c.companyName}</span>}
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {results.interactions.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Interactions</p>
              <div className="space-y-1.5">
                {results.interactions.map((i) => {
                  const href = i.contactId
                    ? `/contacts/${i.contactId}`
                    : i.applicationId
                      ? `/applications/${i.applicationId}`
                      : null;
                  const content = (
                    <>
                      <span className="font-medium">{i.type}</span>
                      <span className="text-muted-foreground">: {i.summary}</span>
                    </>
                  );
                  return (
                    <Card key={i.id} className="py-0 hover:bg-muted/30 transition-colors">
                      <CardContent className="py-3 px-4">
                        {href ? (
                          <Link href={href} className="text-sm hover:underline">
                            {content}
                          </Link>
                        ) : (
                          <span className="text-sm">{content}</span>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
