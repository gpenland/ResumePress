export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { listEntryVersionsForUser, entryLabel } from "@/lib/entries";
import EntryForm from "@/components/EntryForm";
import EntryHistory from "@/components/EntryHistory";
import { updateEntry, deleteEntry, cloneEntry } from "../../actions";
import SubmitButton from "@/components/SubmitButton";
import DeleteItemButton from "@/components/DeleteItemButton";
import PageGrid from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";

export default async function EditEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ resumeId?: string }>;
}) {
  const { id } = await params;
  const { resumeId } = await searchParams;
  const userId = await getUserId();
  if (!userId) notFound();

  const entry = await prisma.entry.findFirst({
    where: { id, userId },
    include: { category: true },
  });

  if (!entry) notFound();

  const resume = resumeId
    ? await prisma.resume.findFirst({ where: { id: resumeId, userId }, select: { id: true, name: true } })
    : null;

  const versions = await listEntryVersionsForUser(userId, id);

  const updateWithId = updateEntry.bind(null, id);
  const deleteWithId = deleteEntry.bind(null, id);
  const cloneWithId = cloneEntry.bind(null, id);

  return (
    <PageGrid
      header={
        <PageHeader
          back={resume ? { href: `/resumes/${resume.id}`, label: resume.name } : { href: "/entries", label: "Entries" }}
          title={entryLabel(entry)}
          description={entry.category.name}
          actions={
            <>
              <form action={cloneWithId}>
                <SubmitButton variant="outline" pendingText="Cloning…">
                  Clone
                </SubmitButton>
              </form>
              <DeleteItemButton label="Delete" action={deleteWithId} itemName={entryLabel(entry)} />
            </>
          }
        />
      }
    >
      <EntryForm category={entry.category} entry={entry} action={updateWithId} submitLabel="Save changes" />
      <EntryHistory versions={versions} />
    </PageGrid>
  );
}
