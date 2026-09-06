export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EntryForm from "@/components/EntryForm";
import { updateEntry, deleteEntry } from "../../actions";

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
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Edit Entry</h1>
        <form action={deleteWithId}>
          <button
            type="submit"
            className="rounded-md border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            onClick={(e) => {
              if (!confirm("Delete this entry? This cannot be undone.")) e.preventDefault();
            }}
          >
            Delete
          </button>
        </form>
      </div>
      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <EntryForm
          categories={categories}
          entry={entry}
          action={updateWithId}
          submitLabel="Save Changes"
        />
      </div>
    </div>
  );
}
