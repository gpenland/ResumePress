export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ResumeBuilder from "@/components/ResumeBuilder";
import { deleteResume } from "../actions";

export default async function ResumeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [resume, allEntries, categories] = await Promise.all([
    prisma.resume.findUnique({
      where: { id },
      include: { entries: { orderBy: { order: "asc" } } },
    }),
    prisma.entry.findMany({
      orderBy: { updatedAt: "desc" },
      include: { category: true },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!resume) notFound();

  const identity = resume.identity as Record<string, string> | null;
  const deleteWithId = deleteResume.bind(null, id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{resume.name}</h1>
          <p className="text-sm text-zinc-500 mt-1">{resume.templateId} template</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/pdf/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-300 transition-colors"
          >
            Download PDF
          </a>
          <form action={deleteWithId}>
            <button
              type="submit"
              className="rounded-md border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2">
          <h2 className="text-sm font-semibold text-zinc-700 mb-4">Select Entries</h2>
          <ResumeBuilder
            resumeId={id}
            allEntries={allEntries}
            selectedEntries={resume.entries}
            categories={categories}
          />
        </div>

        <aside className="space-y-6">
          <div className="bg-white rounded-lg border border-zinc-200 p-5">
            <h2 className="text-sm font-semibold text-zinc-700 mb-4">Identity</h2>
            {identity ? (
              <dl className="space-y-2 text-sm">
                {[
                  ["Name", identity.name],
                  ["Email", identity.email],
                  ["Phone", identity.phone],
                  ["Website", identity.website],
                  ["LinkedIn", identity.linkedin],
                  ["GitHub", identity.github],
                ]
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-zinc-400">{label}</dt>
                      <dd className="text-zinc-700 truncate">{value}</dd>
                    </div>
                  ))}
              </dl>
            ) : (
              <p className="text-sm text-zinc-400">No identity set</p>
            )}
            <Link
              href={`/resumes/${id}/edit`}
              className="mt-4 block text-sm text-blue-600 hover:underline"
            >
              Edit identity
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
