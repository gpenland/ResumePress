export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EntryForm from "@/components/EntryForm";
import { updateEntry, deleteEntry } from "../../actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [entry, categories] = await Promise.all([
    prisma.entry.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!entry) notFound();

  const updateWithId = updateEntry.bind(null, id);
  const deleteWithId = deleteEntry.bind(null, id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Edit Entry</h1>
        <form action={deleteWithId}>
          <Button type="submit" variant="destructive" size="sm">
            Delete Entry
          </Button>
        </form>
      </div>
      <Card>
        <CardContent className="pt-6">
          <EntryForm
            categories={categories}
            entry={entry}
            action={updateWithId}
            submitLabel="Save Changes"
          />
        </CardContent>
      </Card>
    </div>
  );
}
