"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Extension point for Module D (Resume integration, docs/MIGRATION_PLAN.md §5).
// Rendered from applications/[id]/page.tsx (Module A). Do not add contact/
// interaction UI here; that's Module B's own section, added independently.
export default function ResumeSection({
  applicationId,
  resume,
  resumes,
  attach,
  detach,
}: {
  applicationId: string;
  resume: { id: string; name: string } | null;
  resumes: { id: string; name: string }[];
  attach: (applicationId: string, resumeId: string) => Promise<void>;
  detach: (applicationId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [selectedId, setSelectedId] = useState(resumes[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();

  function handleAttach() {
    if (!selectedId) return;
    startTransition(async () => {
      await attach(applicationId, selectedId);
      setPicking(false);
      router.refresh();
    });
  }

  function handleDetach() {
    startTransition(async () => {
      await detach(applicationId);
      router.refresh();
    });
  }

  const showPicker = picking || !resume;

  return (
    <div className="rounded-lg border border-dashed p-4 space-y-3">
      <p className="text-sm font-medium">Resume</p>

      {!showPicker && resume ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{resume.name}</span>
          <Link href={`/resumes/${resume.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Open
          </Link>
          <a
            href={`/api/pdf/${resume.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Recompile PDF
          </a>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPicking(true)}>
            Change
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={handleDetach}
            disabled={isPending}
          >
            Remove
          </Button>
        </div>
      ) : resumes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <Button type="button" size="sm" onClick={handleAttach} disabled={isPending}>
            {isPending ? "Attaching…" : "Attach"}
          </Button>
          {resume && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setPicking(false)}>
              Cancel
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No resumes yet —{" "}
          <Link href="/resumes/new" className="underline hover:text-foreground">
            create one
          </Link>{" "}
          to attach it here.
        </p>
      )}
    </div>
  );
}
