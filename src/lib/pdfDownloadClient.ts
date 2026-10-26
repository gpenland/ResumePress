// Client-side fetch of a PDF route (/api/pdf/[resumeId] or /api/pdf/snapshot/[id])
// that turns a non-200 response into a normal in-app error instead of letting a
// plain <a href>/window.location navigation replace the whole page with the
// route's raw JSON error body. Shared by ResumeBuilder.tsx (download/preview)
// and ResumeSection.tsx (download) so both fail the same, graceful way.

export type PdfFetchResult =
  | { ok: true; blobUrl: string; filename: string }
  | { ok: false; error: string };

function extractFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const match = /filename="([^"]+)"/.exec(contentDisposition);
  return match ? match[1] : null;
}

export async function fetchResumePdf(url: string): Promise<PdfFetchResult> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return { ok: false, error: "Could not reach the server. Check your connection and try again." };
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; detail?: string } | null;
    return { ok: false, error: body?.detail || body?.error || `PDF generation failed (${res.status}).` };
  }

  const blob = await res.blob();
  const filename = extractFilename(res.headers.get("content-disposition")) ?? "resume.pdf";
  return { ok: true, blobUrl: URL.createObjectURL(blob), filename };
}

export function triggerBlobDownload(blobUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Downloads kick off asynchronously in the browser; revoke shortly after
  // rather than immediately so the click has time to take the reference.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
}
