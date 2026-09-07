export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function HomePage() {
  const userId = await getUserId();

  const [recentResumes, recentEntries] = userId
    ? await Promise.all([
        prisma.resume.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 5 }),
        prisma.entry.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          take: 5,
          include: { category: true },
        }),
      ])
    : [[], []];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage your resume entries and builds</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent Resumes</h2>
            <Link href="/resumes/new" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              New resume
            </Link>
          </div>
          {recentResumes.length === 0 ? (
            <EmptyState message="No resumes yet" action={{ label: "Create your first resume", href: "/resumes/new" }} />
          ) : (
            <div className="space-y-2">
              {recentResumes.map((r) => (
                <Link key={r.id} href={`/resumes/${r.id}`}>
                  <Card className="hover:bg-muted/40 transition-colors cursor-pointer py-0">
                    <CardContent className="flex items-center justify-between py-3 px-4">
                      <span className="text-sm font-medium">{r.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.updatedAt).toLocaleDateString()}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent Entries</h2>
            <Link href="/entries/new" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              New entry
            </Link>
          </div>
          {recentEntries.length === 0 ? (
            <EmptyState message="No entries yet" action={{ label: "Add your first entry", href: "/entries/new" }} />
          ) : (
            <div className="space-y-2">
              {recentEntries.map((e) => (
                <Link key={e.id} href={`/entries/${e.id}/edit`}>
                  <Card className="hover:bg-muted/40 transition-colors cursor-pointer py-0">
                    <CardContent className="flex items-center justify-between py-3 px-4">
                      <div>
                        <p className="text-sm font-medium">{e.title}</p>
                        <p className="text-xs text-muted-foreground">{e.category.name}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(e.updatedAt).toLocaleDateString()}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyState({ message, action }: { message: string; action: { label: string; href: string } }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center py-10 text-center gap-3">
        <p className="text-sm text-muted-foreground">{message}</p>
        <Link href={action.href} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          {action.label}
        </Link>
      </CardContent>
    </Card>
  );
}
