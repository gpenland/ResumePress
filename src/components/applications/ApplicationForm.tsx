"use client";

import { useRef, useState, useTransition } from "react";
import type { Application, Company } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import StatusSelect from "@/components/applications/StatusSelect";
import { findNearDuplicateCompanyName } from "@/lib/companiesShared";
import type { JobPostingAutofill } from "@/lib/jobPosting";
import { cn, nativeSelectClassName } from "@/lib/utils";

type Props = {
  companies: Company[];
  application?: Application & { company: Company };
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  autofillFromUrl: (url: string) => Promise<{ ok: true; data: JobPostingAutofill } | { ok: false; error: string }>;
  resumes?: { id: string; name: string }[];
};

function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ApplicationForm({ companies, application, action, submitLabel, autofillFromUrl, resumes }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isAutofilling, startAutofillTransition] = useTransition();
  const [autofillError, setAutofillError] = useState<string | null>(null);
  const [status, setStatus] = useState(application?.status ?? "Applied");
  const [companySuggestion, setCompanySuggestion] = useState<string | null>(null);

  function setFieldIfEmpty(name: string, value: string | null) {
    if (!value) return;
    const input = formRef.current?.elements.namedItem(name);
    if (input instanceof HTMLInputElement && !input.value.trim()) {
      input.value = value;
    }
  }

  function handleAutofill() {
    const urlInput = formRef.current?.elements.namedItem("postingUrl");
    const url = urlInput instanceof HTMLInputElement ? urlInput.value.trim() : "";
    if (!url) {
      setAutofillError("Enter a posting URL first.");
      return;
    }
    setAutofillError(null);
    startAutofillTransition(async () => {
      const result = await autofillFromUrl(url);
      if (!result.ok) {
        setAutofillError(result.error);
        return;
      }
      setFieldIfEmpty("companyName", result.data.companyName);
      setFieldIfEmpty("roleTitle", result.data.roleTitle);
      setFieldIfEmpty("location", result.data.location);
      setFieldIfEmpty("term", result.data.term);
    });
  }

  function handleCompanyBlur(e: React.FocusEvent<HTMLInputElement>) {
    const typed = e.target.value;
    if (!typed.trim()) {
      setCompanySuggestion(null);
      return;
    }
    setCompanySuggestion(findNearDuplicateCompanyName(typed, companies.map((c) => c.name)));
  }

  function acceptCompanySuggestion(name: string) {
    const input = formRef.current?.elements.namedItem("companyName");
    if (input instanceof HTMLInputElement) input.value = name;
    setCompanySuggestion(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(formRef.current!);
    startTransition(async () => {
      await action(data);
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-1.5">
        <Label htmlFor="postingUrl">Posting link</Label>
        <div className="flex gap-2">
          <Input
            id="postingUrl"
            name="postingUrl"
            type="url"
            placeholder="https://..."
            defaultValue={application?.postingUrl ?? ""}
            className="flex-1 bg-background"
          />
          <Button type="button" variant="default" size="sm" onClick={handleAutofill} disabled={isAutofilling}>
            {isAutofilling ? "Fetching…" : "Autofill from link"}
          </Button>
        </div>
        {autofillError && <p className="text-xs text-destructive">{autofillError}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="companyName">Company *</Label>
          <Input
            id="companyName"
            name="companyName"
            list="company-suggestions"
            defaultValue={application?.company.name ?? ""}
            required
            placeholder="e.g. Acme Corp"
            autoComplete="off"
            data-1p-ignore
            onBlur={handleCompanyBlur}
          />
          <datalist id="company-suggestions">
            {companies.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          {companySuggestion && (
            <p className="text-xs text-muted-foreground">
              Did you mean{" "}
              <button
                type="button"
                className="underline hover:text-foreground"
                onClick={() => acceptCompanySuggestion(companySuggestion)}
              >
                &quot;{companySuggestion}&quot;
              </button>
              ?
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="roleTitle">Role *</Label>
          <Input
            id="roleTitle"
            name="roleTitle"
            defaultValue={application?.roleTitle ?? ""}
            required
            placeholder="e.g. Software Engineering Intern"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="term">Term</Label>
          <Input id="term" name="term" defaultValue={application?.term ?? ""} placeholder="e.g. Summer 2027" />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <input type="hidden" name="status" value={status} />
          <StatusSelect value={status} onValueChange={setStatus} className="w-full" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" defaultValue={application?.location ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="appliedAt">Applied</Label>
          <Input
            id="appliedAt"
            name="appliedAt"
            type="date"
            defaultValue={application ? toDateInputValue(application.appliedAt) : todayInputValue()}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="source">Source</Label>
          <Input id="source" name="source" placeholder="e.g. Career fair, referral" defaultValue={application?.source ?? ""} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={4} defaultValue={application?.notes ?? ""} />
      </div>

      {!application && resumes && resumes.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="resumeId">Attach resume</Label>
          <select
            id="resumeId"
            name="resumeId"
            defaultValue=""
            className={cn(nativeSelectClassName(), "w-full")}
          >
            <option value="">No resume</option>
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Pins a snapshot of this resume to the application, same as attaching it from the application page later.
          </p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}
