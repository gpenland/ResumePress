export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateResumeIdentity } from "../../actions";

export default async function EditResumePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resume = await prisma.resume.findUnique({ where: { id } });
  if (!resume) notFound();

  const identity = (resume.identity as Record<string, string>) ?? {};
  const updateWithId = updateResumeIdentity.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 mb-8">Edit Resume</h1>

      <form action={updateWithId} className="space-y-6 bg-white rounded-lg border border-zinc-200 p-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Resume Name *</label>
          <input
            type="text"
            name="resumeName"
            required
            defaultValue={resume.name}
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>

        <h2 className="text-sm font-semibold text-zinc-700">Identity / Contact Info</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Full Name *", name: "name", required: true },
            { label: "Email *", name: "email", type: "email", required: true },
            { label: "Phone", name: "phone" },
            { label: "Website", name: "website", type: "url" },
            { label: "LinkedIn", name: "linkedin" },
            { label: "GitHub", name: "github" },
          ].map((f) => (
            <div key={f.name}>
              <label className="block text-sm font-medium text-zinc-700 mb-1">{f.label}</label>
              <input
                type={f.type ?? "text"}
                name={f.name}
                required={f.required}
                defaultValue={identity[f.name] ?? ""}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
