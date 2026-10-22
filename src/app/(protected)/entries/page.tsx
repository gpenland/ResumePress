export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteEntry, cloneEntry } from "./actions";
import EntryList from "@/components/EntryList";

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const userId = await getUserId();

  const [categories, entries] = await Promise.all([
    prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      orderBy: { name: "asc" },
    }),
    userId
      ? prisma.entry.findMany({
          where: {
            userId,
            ...(category ? { category: { slug: category } } : {}),
          },
          orderBy: { updatedAt: "desc" },
          include: { category: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Entries</h1>
          <p className="text-muted-foreground text-sm mt-1">{entries.length} total</p>
        </div>
        <Link href="/entries/new" className={cn(buttonVariants())}>New Entry</Link>
      </div>

      <EntryList
        categories={categories}
        entries={entries}
        category={category}
        deleteEntry={deleteEntry}
        cloneEntry={cloneEntry}
      />
    </div>
  );
}
