import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { compileResumeToPdf } from "@/lib/resumeCompiler";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ resumeId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { resumeId } = await params;

  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId: session.user.id },
    include: {
      entries: {
        orderBy: { order: "asc" },
        include: {
          entry: { include: { category: true } },
        },
      },
    },
  });

  if (!resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  const identity = (resume.identity ?? {}) as Record<string, string>;

  // Group entries by category, preserving selection order
  const categoryMap = new Map<string, { category: typeof resume.entries[number]["entry"]["category"]; entries: typeof resume.entries[number]["entry"][] }>();
  for (const re of resume.entries) {
    const cat = re.entry.category;
    if (!categoryMap.has(cat.id)) {
      categoryMap.set(cat.id, { category: cat, entries: [] });
    }
    categoryMap.get(cat.id)!.entries.push(re.entry);
  }
  const entriesByCategory = Array.from(categoryMap.values());

  try {
    const pdfBuffer = await compileResumeToPdf(
      resume.templateId,
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

    const safeName = resume.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();

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
