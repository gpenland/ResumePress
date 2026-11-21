export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import EntryForm from "@/components/EntryForm";
import { createEntry } from "../actions";
import PageGrid, { GRID_INSET } from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { Briefcase, GraduationCap, Code2, Wrench, FolderOpen } from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  experience: Briefcase,
  education: GraduationCap,
  projects: Code2,
  skills: Wrench,
};

export default async function NewEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat } = await searchParams;
  const userId = await getUserId();
  const categories = await prisma.category.findMany({
    where: { OR: [{ userId: null }, { userId }] },
    orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
  });

  // Step 2: category selected → show form
  if (cat) {
    const category = categories.find((c) => c.slug === cat);
    if (!category) notFound();

    return (
      <PageGrid
        header={<PageHeader back={{ href: "/entries/new", label: "Entry type" }} title="New entry" description={category.name} />}
      >
        <EntryForm category={category} action={createEntry} submitLabel="Create entry" />
      </PageGrid>
    );
  }

  // Step 1: pick a category
  return (
    <PageGrid
      header={<PageHeader back={{ href: "/entries", label: "Entries" }} title="New entry" description="Choose a type to get started" />}
    >
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.slug] ?? FolderOpen;
          return (
            <Link
              key={cat.id}
              href={`/entries/new?cat=${cat.slug}`}
              className={cn("flex items-center gap-4 border bg-card py-5 transition-colors hover:bg-muted/40", GRID_INSET)}
            >
              <div className="shrink-0 bg-primary/10 p-2.5">
                <Icon className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{cat.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{DESCRIPTIONS[cat.slug] ?? "Custom category"}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </PageGrid>
  );
}

const DESCRIPTIONS: Record<string, string> = {
  experience: "Jobs, internships, volunteer roles",
  education: "Degrees, certifications, courses",
  projects: "Personal, academic, or open-source work",
  skills: "Languages, frameworks, tools",
};
