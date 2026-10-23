import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAllowedUserId } from "@/lib/auth";
import { compileResumeToPdf } from "@/lib/resumeCompiler";
import { snapshotSectionsToEntriesByCategory, type ResumeSnapshotSection } from "@/lib/resumes";

// Compiles a frozen ResumeSnapshot to PDF — the counterpart to
// GET /api/pdf/[resumeId] for the DB-backed live resume, but sourced from a
// snapshot's own inlined entry content instead of live Entry rows. See
// "Resume version history" in CLAUDE.md (GitHub issue #26): once a resume is
// attached to an application, its recompiled PDF must keep reflecting what
// the resume looked like at attach time, not whatever it currently is.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const userId = await getAllowedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { snapshotId } = await params;

  const snapshot = await prisma.resumeSnapshot.findFirst({
    where: { id: snapshotId, userId },
  });
  if (!snapshot) {
    return NextResponse.json({ error: "Resume snapshot not found" }, { status: 404 });
  }

  const identity = (snapshot.identity ?? {}) as Record<string, string>;
  const entriesByCategory = snapshotSectionsToEntriesByCategory(
    snapshot.entries as unknown as ResumeSnapshotSection[]
  );

  try {
    const pdfBuffer = await compileResumeToPdf(
      snapshot.templateId,
      {
        name: identity.name ?? "",
        email: identity.email ?? "",
        phone: identity.phone,
        website: identity.website,
        linkedin: identity.linkedin,
        github: identity.github,
      },
      entriesByCategory
    );

    const safeName = snapshot.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("pdflatex error:", message);
    return NextResponse.json(
      { error: "PDF compilation failed", detail: message },
      { status: 500 }
    );
  }
}
