export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;

  const [categories, entries] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.entry.findMany({
      where: category ? { category: { slug: category } } : undefined,
      orderBy: { updatedAt: "desc" },
      include: { category: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Entries</h1>
          <p className="text-muted-foreground text-sm mt-1">{entries.length} total</p>
        </div>
        <Link href="/entries/new" className={cn(buttonVariants())}>New Entry</Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Link
          href="/entries"
          className={cn(buttonVariants({ variant: !category ? "default" : "outline", size: "sm" }))}
        >
          All
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/entries?category=${cat.slug}`}
            className={cn(buttonVariants({ variant: category === cat.slug ? "default" : "outline", size: "sm" }))}
          >
            {cat.name}
          </Link>
        ))}
      </div>

      {entries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-center gap-3">
            <p className="text-muted-foreground text-sm">No entries found</p>
            <Link href="/entries/new" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Create your first entry
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Link key={entry.id} href={`/entries/${entry.id}/edit`}>
              <Card className="hover:bg-muted/40 transition-colors cursor-pointer py-0">
                <CardContent className="flex items-center justify-between py-3 px-5">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{entry.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[entry.organization, entry.location].filter(Boolean).join(" · ")}
                      {entry.startDate && (
                        <span className="ml-2">
                          {entry.startDate}{entry.endDate ? ` – ${entry.endDate}` : ""}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <Badge variant="secondary">{entry.category.name}</Badge>
                    {entry.bullets.length > 0 && (
                      <span className="text-xs text-muted-foreground">{entry.bullets.length} bullets</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
