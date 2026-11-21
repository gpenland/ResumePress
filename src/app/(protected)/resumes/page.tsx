export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { duplicateResume } from "./actions";
import PageGrid, { GRID_INSET } from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";
import { Panel, PanelEmpty } from "@/components/Panel";
import { formatShortDate } from "@/lib/dateFormat";
import CloneItemButton from "@/components/CloneItemButton";
import ResumeSectionTabs from "@/components/ResumeSectionTabs";

export default async function ResumesPage() {
  const userId = await getUserId();
  const resumes = userId
    ? await prisma.resume.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { entries: true } } },
      })
    : [];

  return (
    <PageGrid
      header={
        <PageHeader
          eyebrow="Resume builder"
          title="Resumes"
          description={`${resumes.length} saved`}
          actions={
            <>
              <ResumeSectionTabs />
              <Link href="/resumes/new" className={cn(buttonVariants())}>New resume</Link>
            </>
          }
        />
      }
    >
      {resumes.length === 0 ? (
        <Panel>
          <PanelEmpty message="No resumes yet" action={{ label: "Add your first resume", href: "/resumes/new" }} />
        </Panel>
      ) : (
        // Four to a row at desktop, so each card spans exactly one grid column.
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {resumes.map((resume) => (
            <div key={resume.id} className="flex flex-col border bg-card transition-colors hover:bg-muted/30">
              <Link href={`/resumes/${resume.id}`} className={cn("flex-1 pt-4 pb-3", GRID_INSET)}>
                <h2 className="truncate text-2xl font-heading">{resume.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {resume._count.entries} {resume._count.entries === 1 ? "entry" : "entries"}
                </p>
              </Link>
              {/* Footer: when it changed on the left, the one card action on the
                  right. Delete lives in the resume editor, not on the card. */}
              <div className={cn("flex items-center justify-between gap-2 border-t py-2", GRID_INSET)}>
                <span className="text-xs text-muted-foreground">Updated {formatShortDate(resume.updatedAt)}</span>
                <CloneItemButton action={duplicateResume.bind(null, resume.id)} itemName={resume.name} />
              </div>
            </div>
          ))}
        </div>
      )}
    </PageGrid>
  );
}
