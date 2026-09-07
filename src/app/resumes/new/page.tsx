import { createResume } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SubmitButton from "@/components/SubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const TEMPLATES = [
  { id: "jake", name: "Jake's Resume", description: "Classic single-column professional template" },
];

export default function NewResumePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Resume</h1>
        <p className="text-muted-foreground text-sm mt-1">Set up your resume details and contact info</p>
      </div>

      <form action={createResume} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resume Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="resumeName">Resume Name *</Label>
              <Input id="resumeName" name="resumeName" required placeholder="e.g. Software Engineer Resume" />
            </div>
            <div className="space-y-2">
              <Label>Template</Label>
              {TEMPLATES.map((t) => (
                <label
                  key={t.id}
                  className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  <input type="radio" name="templateId" value={t.id} defaultChecked className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity / Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Full Name *", name: "name", required: true },
              { label: "Email *", name: "email", type: "email", required: true },
              { label: "Phone", name: "phone", placeholder: "+1 (555) 000-0000" },
              { label: "Website", name: "website", type: "url", placeholder: "https://..." },
              { label: "LinkedIn", name: "linkedin", placeholder: "linkedin.com/in/..." },
              { label: "GitHub", name: "github", placeholder: "github.com/..." },
            ].map((f) => (
              <div key={f.name} className="space-y-1.5">
                <Label htmlFor={f.name}>{f.label}</Label>
                <Input
                  id={f.name}
                  name={f.name}
                  type={f.type ?? "text"}
                  required={f.required}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <SubmitButton pendingText="Creating…">Create Resume</SubmitButton>
        </div>
      </form>
    </div>
  );
}
