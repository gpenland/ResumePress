export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import ResumeBuilder from "@/components/ResumeBuilder";
import { deleteResume } from "../actions";
import PageGrid from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";
import { Panel, FactList } from "@/components/Panel";
import DeleteItemButton from "@/components/DeleteItemButton";

// Display names for template ids — "jake" is an internal key, not a label.
const TEMPLATE_NAMES: Record<string, string> = { jake: "Jake's Resume" };

export default async function ResumeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) notFound();

  const [resume, allEntries, categories] = await Promise.all([
    prisma.resume.findFirst({
      where: { id, userId },
      include: { entries: { orderBy: { order: "asc" } } },
    }),
    prisma.entry.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: { category: true },
    }),
    prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!resume) notFound();

  const identity = resume.identity as Record<string, string> | null;
  const identityFacts = identity
    ? (
        [
          ["Name", identity.name],
          ["Email", identity.email],
          ["Phone", identity.phone],
          ["Website", identity.website],
          ["LinkedIn", identity.linkedin],
          ["GitHub", identity.github],
        ] as Array<[string, string | undefined]>
      ).filter((f): f is [string, string] => Boolean(f[1]))
    : [];

  return (
    <PageGrid
      header={
        <PageHeader
          back={{ href: "/resumes", label: "Resumes" }}
          title={resume.name}
          description={`${TEMPLATE_NAMES[resume.templateId] ?? resume.templateId} template`}
          // Delete is a quiet outline button with a confirmation, not the
          // loudest thing on the page; Save / Preview / Download live with
          // the list and preview they act on.
          actions={<DeleteItemButton label="Delete" action={deleteResume.bind(null, id)} itemName={resume.name} />}
        />
      }
    >
      <ResumeBuilder
        resumeId={id}
        allEntries={allEntries}
        selectedEntries={resume.entries}
        categories={categories}
        identityPanel={
          <Panel title="Identity" action={{ label: "Edit", href: `/resumes/${id}/edit` }} padded>
            {identityFacts.length > 0 ? (
              <FactList facts={identityFacts} />
            ) : (
              <p className="text-sm text-muted-foreground">No identity set</p>
            )}
          </Panel>
        }
      />
    </PageGrid>
  );
}
