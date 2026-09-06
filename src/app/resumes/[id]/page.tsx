export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ResumeBuilder from "@/components/ResumeBuilder";
import { deleteResume } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export default async function ResumeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [resume, allEntries, categories] = await Promise.all([
    prisma.resume.findUnique({
      where: { id },
      include: { entries: { orderBy: { order: "asc" } } },
    }),
    prisma.entry.findMany({
      orderBy: { updatedAt: "desc" },
      include: { category: true },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!resume) notFound();

  const identity = resume.identity as Record<string, string> | null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{resume.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{resume.templateId} template</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <form action={deleteResume.bind(null, id)}>
            <Button type="submit" variant="destructive" size="sm">Delete</Button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <ResumeBuilder
            resumeId={id}
            allEntries={allEntries}
            selectedEntries={resume.entries}
            categories={categories}
          />
        </div>

        <aside>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Identity</CardTitle>
                <Link href={`/resumes/${id}/edit`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                  Edit
                </Link>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-3">
              {identity ? (
                [
                  ["Name", identity.name],
                  ["Email", identity.email],
                  ["Phone", identity.phone],
                  ["Website", identity.website],
                  ["LinkedIn", identity.linkedin],
                  ["GitHub", identity.github],
                ]
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm truncate">{value}</p>
                    </div>
                  ))
              ) : (
                <p className="text-sm text-muted-foreground">No identity set</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
