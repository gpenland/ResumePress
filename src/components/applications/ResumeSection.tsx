"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn, nativeSelectClassName } from "@/lib/utils";
import { fetchResumePdf, triggerBlobDownload } from "@/lib/pdfDownloadClient";

// Extension point for Module D (Resume integration, docs/MIGRATION_PLAN.md §5).
// Rendered from applications/[id]/page.tsx (Module A). Do not add contact/
// interaction UI here; that's Module B's own section, added independently.
export default function ResumeSection({
  applicationId,
  resume,
  snapshot,
  resumes,
  attach,
  detach,
}: {
  applicationId: string;
  resume: { id: string; name: string } | null;
  snapshot: { id: string; createdAt: Date } | null;
  resumes: { id: string; name: string }[];
  attach: (applicationId: string, resumeId: string) => Promise<void>;
  detach: (applicationId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [selectedId, setSelectedId] = useState(resumes[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloading, startDownload] = useTransition();

  function handleDownload(url: string) {
    startDownload(async () => {
      setDownloadError(null);
      const result = await fetchResumePdf(url);
      if (!result.ok) {
        setDownloadError(result.error);
        return;
      }
      triggerBlobDownload(result.blobUrl, result.filename);
    });
  }

  function handleAttach(resumeId?: string) {
    const id = resumeId ?? selectedId;
    if (!id) return;
    startTransition(async () => {
      await attach(applicationId, id);
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleDownload(snapshot ? `/api/pdf/snapshot/${snapshot.id}` : `/api/pdf/${resume.id}`)}
            disabled={isDownloading}
          >
            {isDownloading ? "Generating…" : "Download PDF"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPicking(true)}>
            Change
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleAttach(resume.id)}
            disabled={isPending}
          >
            {isPending ? "Refreshing…" : "Refresh snapshot"}
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
          {downloadError && (
            <span className="text-xs text-destructive basis-full">{downloadError}</span>
          )}
          {snapshot && (
            <span className="text-xs text-muted-foreground basis-full">
              Pinned to the version from {new Date(snapshot.createdAt).toLocaleDateString()}. Editing the
              resume won&apos;t change this until you refresh the snapshot.
            </span>
          )}
        </div>
      ) : resumes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className={nativeSelectClassName()}
          >
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <Button type="button" size="sm" onClick={() => handleAttach()} disabled={isPending}>
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
          No resumes yet.{" "}
          <Link href="/resumes/new" className="underline hover:text-foreground">
            Create one
          </Link>{" "}
          to attach it here.
        </p>
      )}
    </div>
  );
}
