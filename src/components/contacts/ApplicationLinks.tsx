"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type LinkedApplication = {
  applicationId: string;
  role: string;
  roleTitle: string;
  companyName: string;
};

export type ApplicationOption = { id: string; label: string };

type Props = {
  contactId: string;
  linked: LinkedApplication[];
  applicationOptions: ApplicationOption[];
  link: (contactId: string, applicationId: string, role: string) => Promise<void>;
  unlink: (contactId: string, applicationId: string) => Promise<void>;
};

export default function ApplicationLinks({ contactId, linked, applicationOptions, link, unlink }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const linkedIds = new Set(linked.map((l) => l.applicationId));
  const available = applicationOptions.filter((a) => !linkedIds.has(a.id));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(formRef.current!);
    const applicationId = data.get("applicationId") as string;
    const role = (data.get("role") as string) || "Other";
    if (!applicationId) return;
    startTransition(async () => {
      await link(contactId, applicationId, role);
      formRef.current?.reset();
      router.refresh();
    });
  }

  function handleUnlink(applicationId: string) {
    startTransition(async () => {
      await unlink(contactId, applicationId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {linked.length === 0 ? (
        <p className="text-muted-foreground text-sm px-1">Not linked to any applications.</p>
      ) : (
        <div className="space-y-1.5">
          {linked.map((l) => (
            <div key={l.applicationId} className="flex items-center gap-2 text-sm px-1">
              <Link href={`/applications/${l.applicationId}`} className="hover:underline">
                {l.roleTitle} @ {l.companyName}
              </Link>
              <span className="text-muted-foreground text-xs">({l.role})</span>
              <button
                type="button"
                onClick={() => handleUnlink(l.applicationId)}
                disabled={isPending}
                className="text-xs text-muted-foreground hover:text-destructive ml-auto"
              >
                Unlink
              </button>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 pt-1">
          <select
            name="applicationId"
            required
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Link to application…
            </option>
            {available.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <Input name="role" placeholder="Role (e.g. Recruiter)" className="w-44 h-8" />
          <Button type="submit" size="sm" variant="outline" disabled={isPending}>
            Link
          </Button>
        </form>
      )}
    </div>
  );
}
