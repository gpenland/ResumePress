"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { nativeSelectClassName } from "@/lib/utils";
import { fetchResumePdf, triggerBlobDownload } from "@/lib/pdfDownloadClient";
import { formatShortDate } from "@/lib/dateFormat";

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

  // Rendered inside the detail page's "Resume" panel, which supplies the
  // heading. Two button styles only: outline for the actions, and a quiet
  // ghost for Remove so the destructive one never looks like the default.
  return (
    <div className="space-y-3">
      {!showPicker && resume ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {/* The name is the link to open it — no separate "Open" button. */}
            <Link href={`/resumes/${resume.id}`} className="mr-2 text-sm font-medium underline-offset-2 hover:underline">
              {resume.name}
            </Link>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDownload(snapshot ? `/api/pdf/snapshot/${snapshot.id}` : `/api/pdf/${resume.id}`)}
              disabled={isDownloading}
            >
              {isDownloading ? "Generating…" : "Download PDF"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setPicking(true)}>
              Change
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive sm:ml-auto"
              onClick={handleDetach}
              disabled={isPending}
            >
              Remove
            </Button>
          </div>
          {downloadError && <p className="text-xs text-destructive">{downloadError}</p>}
          <p className="text-xs text-muted-foreground">
            {snapshot
              ? `Pinned to the version from ${formatShortDate(snapshot.createdAt)}. Editing the resume won't change this until you `
              : "Not pinned yet — this uses the resume as it is now. "}
            <button
              type="button"
              onClick={() => handleAttach(resume.id)}
              disabled={isPending}
              className="font-medium text-foreground underline underline-offset-2 disabled:opacity-50"
            >
              {isPending ? "refreshing…" : snapshot ? "refresh the snapshot" : "pin the current version"}
            </button>
            {snapshot ? "." : ""}
          </p>
        </>
      ) : resumes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            aria-label="Resume to attach"
            className={nativeSelectClassName()}
          >
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={() => handleAttach()} disabled={isPending}>
            {isPending ? "Attaching…" : "Attach"}
          </Button>
          {resume && (
            <Button type="button" variant="ghost" onClick={() => setPicking(false)}>
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
