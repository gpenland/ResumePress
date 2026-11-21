export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cloneEntry } from "./actions";
import PageGrid from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";
import EntryList from "@/components/EntryList";
import ResumeSectionTabs from "@/components/ResumeSectionTabs";

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
    <PageGrid
      header={
        <PageHeader
          eyebrow="Resume builder"
          title="Entries"
          description={`${entries.length} total`}
          actions={
            <>
              <ResumeSectionTabs />
              <Link href="/categories" className={cn(buttonVariants({ variant: "outline" }))}>
                Manage categories
              </Link>
              <Link href="/entries/new" className={cn(buttonVariants())}>New entry</Link>
            </>
          }
        />
      }
    >
      <EntryList categories={categories} entries={entries} category={category} cloneEntry={cloneEntry} />
    </PageGrid>
  );
}
