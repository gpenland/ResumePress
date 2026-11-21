import { createResume } from "../actions";
import PageGrid from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import SubmitButton from "@/components/SubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TEMPLATES = [
  { id: "jake", name: "Jake's Resume", description: "Classic single-column professional template" },
];

export default function NewResumePage() {
  return (
    <PageGrid
      header={
        <PageHeader
          back={{ href: "/resumes", label: "Resumes" }}
          title="New resume"
          description="Set up your resume details and contact info"
        />
      }
    >
      <form action={createResume} className="space-y-8 lg:w-1/2">
        <Panel title="Details" padded>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="resumeName">Resume name *</Label>
              <Input id="resumeName" name="resumeName" required placeholder="e.g. Software Engineer Resume" />
            </div>
            <div className="space-y-2">
              <Label>Template</Label>
              {TEMPLATES.map((t) => (
                <label
                  key={t.id}
                  className="flex items-start gap-3 border p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  <input type="radio" name="templateId" value={t.id} defaultChecked className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Contact info" padded>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Full name *", name: "name", required: true },
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
          </div>
        </Panel>

        <div className="flex justify-end">
          <SubmitButton pendingText="Creating…">Create resume</SubmitButton>
        </div>
      </form>
    </PageGrid>
  );
}
