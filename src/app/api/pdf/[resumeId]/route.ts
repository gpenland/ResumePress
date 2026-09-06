import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { render } from "@/templates/jake";
import { exec } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execAsync = promisify(exec);

const TEMPLATE_RENDERERS: Record<string, typeof render> = {
  jake: render,
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ resumeId: string }> }
) {
  const { resumeId } = await params;

  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
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

  const renderer = TEMPLATE_RENDERERS[resume.templateId] ?? render;
  const identity = (resume.identity ?? {}) as Record<string, string>;

  // Group entries by category, preserving selection order
  const categoryMap = new Map<string, { category: { id: string; name: string; slug: string; isBuiltIn: boolean }; entries: typeof resume.entries[number]["entry"][] }>();
  for (const re of resume.entries) {
    const cat = re.entry.category;
    if (!categoryMap.has(cat.id)) {
      categoryMap.set(cat.id, { category: cat, entries: [] });
    }
    categoryMap.get(cat.id)!.entries.push(re.entry);
  }
  const entriesByCategory = Array.from(categoryMap.values());

  const latex = renderer(
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

  const tmpDir = await mkdtemp(join(tmpdir(), "resumepress-"));
  const texPath = join(tmpDir, "resume.tex");

  try {
    await writeFile(texPath, latex, "utf-8");

    // Run pdflatex twice to resolve references
    const pdflatexCmd = `pdflatex -interaction=nonstopmode -output-directory="${tmpDir}" "${texPath}"`;
    await execAsync(pdflatexCmd);
    await execAsync(pdflatexCmd);

    const pdfPath = join(tmpDir, "resume.pdf");
    const pdfBuffer = await readFile(pdfPath);

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
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
