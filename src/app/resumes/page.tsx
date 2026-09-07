export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { deleteResume } from "./actions";
import DeleteItemButton from "@/components/DeleteItemButton";

export default async function ResumesPage() {
  const resumes = await prisma.resume.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { entries: true } } },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Resumes</h1>
          <p className="text-muted-foreground text-sm mt-1">{resumes.length} saved</p>
        </div>
        <Link href="/resumes/new" className={cn(buttonVariants())}>New Resume</Link>
      </div>

      {resumes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-center gap-3">
            <p className="text-muted-foreground text-sm">No resumes yet</p>
            <Link href="/resumes/new" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Create your first resume
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resumes.map((resume) => (
            <Card key={resume.id} className="hover:bg-muted/30 transition-colors">
              <CardHeader className="pb-2 flex-row items-start justify-between gap-2">
                <Link href={`/resumes/${resume.id}`} className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">{resume.name}</CardTitle>
                </Link>
                <DeleteItemButton
                  action={deleteResume.bind(null, resume.id)}
                  itemName={resume.name}
                />
              </CardHeader>
              <Link href={`/resumes/${resume.id}`}>
                <CardContent className="space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary">{resume._count.entries} entries</Badge>
                    <Badge variant="outline">{resume.templateId}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(resume.updatedAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
