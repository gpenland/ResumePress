export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function ResumesPage() {
  const resumes = await prisma.resume.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { entries: true } } },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Resumes</h1>
        <Link
          href="/resumes/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          New Resume
        </Link>
      </div>

      {resumes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-white py-16 text-center">
          <p className="text-zinc-400 mb-3">No resumes yet</p>
          <Link href="/resumes/new" className="text-sm text-blue-600 hover:underline">
            Create your first resume
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resumes.map((resume) => (
            <Link
              key={resume.id}
              href={`/resumes/${resume.id}`}
              className="rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-300 transition-colors"
            >
              <p className="font-semibold text-zinc-900 mb-1">{resume.name}</p>
              <p className="text-sm text-zinc-500">
                {resume._count.entries} entries · {resume.templateId} template
              </p>
              <p className="text-xs text-zinc-400 mt-3">
                Updated {new Date(resume.updatedAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
