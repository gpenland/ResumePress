export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EntryForm from "@/components/EntryForm";
import { createEntry } from "../actions";
import { Card, CardContent } from "@/components/ui/card";
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
  const categories = await prisma.category.findMany({ orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }] });

  // Step 2: category selected → show form
  if (cat) {
    const category = categories.find((c) => c.slug === cat);
    if (!category) notFound();

    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/entries/new" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-2xl font-bold tracking-tight">New {category.name} Entry</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <EntryForm category={category} action={createEntry} submitLabel="Create Entry" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 1: pick a category
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Entry</h1>
        <p className="text-muted-foreground text-sm mt-1">Choose a type to get started</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {categories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.slug] ?? FolderOpen;
          return (
            <Link key={cat.id} href={`/entries/new?cat=${cat.slug}`}>
              <Card className="hover:bg-muted/40 transition-colors cursor-pointer h-full py-0">
                <CardContent className="flex items-center gap-4 py-5 px-5">
                  <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{cat.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {DESCRIPTIONS[cat.slug] ?? "Custom category"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const DESCRIPTIONS: Record<string, string> = {
  experience: "Jobs, internships, volunteer roles",
  education: "Degrees, certifications, courses",
  projects: "Personal, academic, or open-source work",
  skills: "Languages, frameworks, tools",
};
