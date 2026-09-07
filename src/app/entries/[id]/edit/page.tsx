export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EntryForm from "@/components/EntryForm";
import { updateEntry, deleteEntry } from "../../actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const entry = await prisma.entry.findUnique({
    where: { id },
    include: { category: true },
  });

  if (!entry) notFound();

  const updateWithId = updateEntry.bind(null, id);
  const deleteWithId = deleteEntry.bind(null, id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Edit Entry</h1>
          <Badge variant="secondary">{entry.category.name}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/entries/new" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            New Entry
          </Link>
          <form action={deleteWithId}>
            <Button type="submit" variant="destructive" size="sm">Delete Entry</Button>
          </form>
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">
          <EntryForm
            category={entry.category}
            entry={entry}
            action={updateWithId}
            submitLabel="Save Changes"
          />
        </CardContent>
      </Card>
    </div>
  );
}
