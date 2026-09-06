export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import EntryForm from "@/components/EntryForm";
import { createEntry } from "../actions";

export default async function NewEntryPage() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 mb-8">New Entry</h1>
      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <EntryForm categories={categories} action={createEntry} submitLabel="Create Entry" />
      </div>
    </div>
  );
}
