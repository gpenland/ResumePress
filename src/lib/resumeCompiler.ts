import { exec } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { render, type Identity, type EntriesByCategory } from "@/templates/jake";

export type { Identity, CategoryLike, EntryLike, EntriesByCategory } from "@/templates/jake";

const execAsync = promisify(exec);

// Per-invocation timeout; pdflatex is run twice per compile, so worst case is 2x this.
const PDFLATEX_TIMEOUT_MS = 15_000;

type TemplateRenderer = typeof render;

const TEMPLATE_RENDERERS: Record<string, TemplateRenderer> = {
  jake: render,
};

export function getTemplateRenderer(templateId: string): TemplateRenderer | null {
  return TEMPLATE_RENDERERS[templateId] ?? null;
}

export async function compileResumeToPdf(
  templateId: string,
  identity: Identity,
  entriesByCategory: EntriesByCategory
) {
  const renderer = getTemplateRenderer(templateId) ?? render;
  const latex = renderer(identity, entriesByCategory);

  const tmpDir = await mkdtemp(join(tmpdir(), "resumepress-"));
  const texPath = join(tmpDir, "resume.tex");

  try {
    await writeFile(texPath, latex, "utf-8");

    // Run pdflatex twice to resolve references
    const pdflatexCmd = `pdflatex -interaction=nonstopmode -output-directory="${tmpDir}" "${texPath}"`;
    await execAsync(pdflatexCmd, { timeout: PDFLATEX_TIMEOUT_MS });
    await execAsync(pdflatexCmd, { timeout: PDFLATEX_TIMEOUT_MS });

    const pdfPath = join(tmpDir, "resume.pdf");
    return await readFile(pdfPath);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
