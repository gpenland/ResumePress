export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { updateResumeIdentity } from "../../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    { label: "Full Name *", name: "name", required: true },
    { label: "Email *", name: "email", type: "email", required: true },
    { label: "Phone", name: "phone" },
    { label: "Website", name: "website", type: "url" },
    { label: "LinkedIn", name: "linkedin" },
    { label: "GitHub", name: "github" },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Edit Resume</h1>

      <form action={updateWithId} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resume Name</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label htmlFor="resumeName">Name *</Label>
              <Input id="resumeName" name="resumeName" required defaultValue={resume.name} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity / Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <SubmitButton pendingText="Saving…">Save Changes</SubmitButton>
        </div>
      </form>
    </div>
  );
}
