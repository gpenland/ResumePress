export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;

  const [categories, entries] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.entry.findMany({
      where: category ? { category: { slug: category } } : undefined,
      orderBy: { updatedAt: "desc" },
      include: { category: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Entries</h1>
        <Link
          href="/entries/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          New Entry
        </Link>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <FilterChip label="All" href="/entries" active={!category} />
        {categories.map((cat) => (
          <FilterChip
            key={cat.id}
            label={cat.name}
            href={`/entries?category=${cat.slug}`}
            active={category === cat.slug}
          />
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-white py-16 text-center">
          <p className="text-zinc-400 mb-3">No entries found</p>
          <Link href="/entries/new" className="text-sm text-blue-600 hover:underline">
            Create your first entry
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Link
              key={entry.id}
              href={`/entries/${entry.id}/edit`}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-5 py-4 hover:border-zinc-300 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium text-zinc-900 truncate">{entry.title}</p>
                <p className="text-sm text-zinc-500 mt-0.5">
                  {[entry.organization, entry.location].filter(Boolean).join(" · ")}
                  {entry.startDate && (
                    <span className="ml-2 text-zinc-400">
                      {entry.startDate}
                      {entry.endDate ? ` – ${entry.endDate}` : ""}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600">
                  {entry.category.name}
                </span>
                {entry.bullets.length > 0 && (
                  <span className="text-xs text-zinc-400">{entry.bullets.length} bullets</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-sm transition-colors ${
        active
          ? "bg-zinc-900 text-white"
          : "bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300"
      }`}
    >
      {label}
    </Link>
  );
}
