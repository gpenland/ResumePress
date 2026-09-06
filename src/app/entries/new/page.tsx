export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import EntryForm from "@/components/EntryForm";
import { createEntry } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewEntryPage() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight mb-8">New Entry</h1>
      <Card>
        <CardContent className="pt-6">
          <EntryForm categories={categories} action={createEntry} submitLabel="Create Entry" />
        </CardContent>
      </Card>
    </div>
  );
}
