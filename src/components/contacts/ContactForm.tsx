"use client";

import { useRef, useTransition } from "react";
import type { Contact, Company } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Props = {
  companies: Company[];
  contact?: Contact & { company: Company | null };
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
};

const HOW_MET_SUGGESTIONS = ["Career fair", "Referral", "Cold outreach", "LinkedIn", "Conference"];

function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export default function ContactForm({ companies, contact, action, submitLabel }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(formRef.current!);
    startTransition(async () => {
      await action(data);
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" name="name" defaultValue={contact?.name ?? ""} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="companyName">Company</Label>
          <Input
            id="companyName"
            name="companyName"
            list="company-suggestions"
            defaultValue={contact?.company?.name ?? ""}
            placeholder="e.g. Acme Corp"
          />
          <datalist id="company-suggestions">
            {companies.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" defaultValue={contact?.title ?? ""} placeholder="e.g. Recruiter" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={contact?.phone ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="emails">Email(s)</Label>
          <Input id="emails" name="emails" placeholder="comma-separated" defaultValue={contact?.emails.join(", ") ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="linkedinUrl">LinkedIn</Label>
          <Input id="linkedinUrl" name="linkedinUrl" type="url" placeholder="https://linkedin.com/in/..." defaultValue={contact?.linkedinUrl ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="howMet">How met</Label>
          <Input id="howMet" name="howMet" list="how-met-suggestions" defaultValue={contact?.howMet ?? ""} />
          <datalist id="how-met-suggestions">
            {HOW_MET_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="metAt">Met on</Label>
          <Input id="metAt" name="metAt" type="date" defaultValue={toDateInputValue(contact?.metAt)} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="tags">Tags</Label>
          <Input id="tags" name="tags" placeholder="comma-separated" defaultValue={contact?.tags.join(", ") ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nextFollowUpAt">Next follow-up</Label>
          <Input id="nextFollowUpAt" name="nextFollowUpAt" type="date" defaultValue={toDateInputValue(contact?.nextFollowUpAt)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={4} defaultValue={contact?.notes ?? ""} />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}
