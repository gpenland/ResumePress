export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { updateResumeIdentity } from "../../actions";
import PageGrid from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import SubmitButton from "@/components/SubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function EditResumePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) notFound();
  const resume = await prisma.resume.findFirst({ where: { id, userId } });
  if (!resume) notFound();

  const identity = (resume.identity as Record<string, string>) ?? {};
  const updateWithId = updateResumeIdentity.bind(null, id);

  const fields = [
    { label: "Full name *", name: "name", required: true },
    { label: "Email *", name: "email", type: "email", required: true },
    { label: "Phone", name: "phone" },
    { label: "Website", name: "website", type: "url" },
    { label: "LinkedIn", name: "linkedin" },
    { label: "GitHub", name: "github" },
  ];

  return (
    <PageGrid header={<PageHeader back={{ href: `/resumes/${id}`, label: resume.name }} title="Edit resume" />}>
      <form action={updateWithId} className="space-y-8 lg:w-1/2">
        <Panel title="Details" padded>
          <div>
            <div className="space-y-1.5">
              <Label htmlFor="resumeName">Resume name *</Label>
              <Input id="resumeName" name="resumeName" required defaultValue={resume.name} />
            </div>
          </div>
        </Panel>

        <Panel title="Contact info" padded>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map((f) => (
              <div key={f.name} className="space-y-1.5">
                <Label htmlFor={f.name}>{f.label}</Label>
                <Input
                  id={f.name}
                  name={f.name}
                  type={f.type ?? "text"}
                  required={f.required}
                  defaultValue={identity[f.name] ?? ""}
                />
              </div>
            ))}
          </div>
        </Panel>

        <div className="flex justify-end">
          <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
        </div>
      </form>
    </PageGrid>
  );
}
