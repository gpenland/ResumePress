export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const [recentResumes, recentEntries, counts] = await Promise.all([
    prisma.resume.findMany({ orderBy: { updatedAt: "desc" }, take: 5 }),
    prisma.entry.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { category: true },
    }),
    prisma.$transaction([
      prisma.entry.count(),
      prisma.resume.count(),
      prisma.category.count(),
    ]),
  ]);

  const [entryCount, resumeCount, categoryCount] = counts;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your resume entries and builds</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-10">
        <StatCard label="Entries" value={entryCount} href="/entries" />
        <StatCard label="Resumes" value={resumeCount} href="/resumes" />
        <StatCard label="Categories" value={categoryCount} href="/categories" />
      </div>

      <div className="grid grid-cols-2 gap-8">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-zinc-800">Recent Resumes</h2>
            <Link href="/resumes/new" className="text-sm text-blue-600 hover:underline">
              New resume
            </Link>
          </div>
          {recentResumes.length === 0 ? (
            <EmptyState
              message="No resumes yet"
              action={{ label: "Create your first resume", href: "/resumes/new" }}
            />
          ) : (
            <ul className="space-y-2">
              {recentResumes.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/resumes/${r.id}`}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-300 transition-colors"
                  >
                    <span className="text-sm font-medium text-zinc-800">{r.name}</span>
                    <span className="text-xs text-zinc-400">
                      {new Date(r.updatedAt).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-zinc-800">Recent Entries</h2>
            <Link href="/entries/new" className="text-sm text-blue-600 hover:underline">
              New entry
            </Link>
          </div>
          {recentEntries.length === 0 ? (
            <EmptyState
              message="No entries yet"
              action={{ label: "Add your first entry", href: "/entries/new" }}
            />
          ) : (
            <ul className="space-y-2">
              {recentEntries.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/entries/${e.id}/edit`}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-300 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{e.title}</p>
                      <p className="text-xs text-zinc-400">{e.category.name}</p>
                    </div>
                    <span className="text-xs text-zinc-400">
                      {new Date(e.updatedAt).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-zinc-200 bg-white px-5 py-4 hover:border-zinc-300 transition-colors"
    >
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      <p className="text-sm text-zinc-500 mt-0.5">{label}</p>
    </Link>
  );
}

function EmptyState({
  message,
  action,
}: {
  message: string;
  action: { label: string; href: string };
}) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-200 bg-white px-4 py-8 text-center">
      <p className="text-sm text-zinc-400 mb-3">{message}</p>
      <Link href={action.href} className="text-sm text-blue-600 hover:underline">
        {action.label}
      </Link>
    </div>
  );
}
