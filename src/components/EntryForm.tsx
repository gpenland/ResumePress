"use client";

import { useRef, useState, useTransition } from "react";
import type { Category, Entry } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, badgeVariants } from "@/components/ui/badge";
import RichTextArea from "@/components/RichTextArea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { getFieldConfig } from "@/lib/entryFields";
import { scoreBulletText } from "@/app/(protected)/entries/actions";
import { cn } from "cn";

type Props = {
  category: Category;
  entry?: Entry;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
};

type BulletScoreResult = { score: number; confidence: number; legend: Record<string, string> };
type BulletScoreState = BulletScoreResult | { error: string };

const XYZ_LEVEL_LABELS = ["Needs XYZ", "Partial XYZ", "Full XYZ"] as const;
const XYZ_LEVEL_VARIANTS = ["destructive", "secondary", "default"] as const;

function confidenceWord(confidence: number): string {
  if (confidence > 0.9) return "clear read";
  if (confidence >= 0.5) return "rough read";
  return "uncertain";
}

function BulletScoreBadge({ result }: { result: BulletScoreResult }) {
  const level = Math.min(2, Math.max(0, Math.round(result.score)));
  return (
    <div className="flex items-center gap-2 text-xs flex-wrap">
      <Badge variant={XYZ_LEVEL_VARIANTS[level]}>{XYZ_LEVEL_LABELS[level]}</Badge>
      <span className="text-muted-foreground">
        {result.legend[String(level)]} · {confidenceWord(result.confidence)}
      </span>
    </div>
  );
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";

// A clickable pill styled exactly like the score badges it turns into once clicked —
// idle "Score bullets" -> "Scoring…" -> the overall level badge (or "Score failed").
function ScoreBubbleButton({
  state,
  onClick,
  disabled,
}: {
  state: "loading" | BulletScoreState | null;
  onClick: () => void;
  disabled: boolean;
}) {
  let label = "Score bullets";
  let variant: BadgeVariant = "outline";

  if (state === "loading") {
    label = "Scoring…";
  } else if (state && "error" in state) {
    label = "Score failed";
    variant = "destructive";
  } else if (state) {
    const level = Math.min(2, Math.max(0, Math.round(state.score)));
    label = XYZ_LEVEL_LABELS[level];
    variant = XYZ_LEVEL_VARIANTS[level];
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        badgeVariants({ variant }),
        "cursor-pointer hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60 transition-opacity"
      )}
    >
      {label}
    </button>
  );
}

export default function EntryForm({ category, entry, action, submitLabel }: Props) {
  const cfg = getFieldConfig(category.slug);
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const [title, setTitle] = useState(entry?.title ?? "");
  const [displayTitle, setDisplayTitle] = useState(entry?.displayTitle ?? "");
  const [organization, setOrganization] = useState(entry?.organization ?? "");
  const [location, setLocation] = useState(entry?.location ?? "");
  const [startDate, setStartDate] = useState(entry?.startDate ?? "");
  const [endDate, setEndDate] = useState(entry?.endDate ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [tags, setTags] = useState(entry?.tags.join(", ") ?? "");
  const [bullets, setBullets] = useState<string[]>(entry?.bullets.length ? entry.bullets : [""]);
  const [draggedBulletIndex, setDraggedBulletIndex] = useState<number | null>(null);
  const [dragOverBulletIndex, setDragOverBulletIndex] = useState<number | null>(null);
  const [bulletScores, setBulletScores] = useState<Record<number, BulletScoreState>>({});
  const [overallScore, setOverallScore] = useState<BulletScoreState | null>(null);
  const [isScoringAll, setIsScoringAll] = useState(false);

  async function handleScoreAll() {
    const scorable = bullets
      .map((text, index) => ({ text, index }))
      .filter((b) => b.text.trim().length > 0);
    if (scorable.length === 0) return;

    setIsScoringAll(true);
    const results = await Promise.all(scorable.map((b) => scoreBulletText(b.text)));

    const newScores: Record<number, BulletScoreState> = {};
    results.forEach((result, i) => {
      newScores[scorable[i].index] = result.ok
        ? { score: result.score, confidence: result.confidence, legend: result.legend }
        : { error: result.error };
    });
    setBulletScores(newScores);

    const oks = Object.values(newScores).filter((s): s is BulletScoreResult => !("error" in s));
    if (oks.length === 0) {
      const firstError = Object.values(newScores).find((s): s is { error: string } => "error" in s);
      setOverallScore({ error: firstError?.error ?? "Could not score bullets." });
    } else {
      setOverallScore({
        score: oks.reduce((sum, o) => sum + o.score, 0) / oks.length,
        confidence: oks.reduce((sum, o) => sum + o.confidence, 0) / oks.length,
        legend: oks[0].legend,
      });
    }
    setIsScoringAll(false);
  }

  function addBullet() { setBullets((p) => [...p, ""]); }
  function updateBullet(i: number, val: string) { setBullets((p) => p.map((b, idx) => idx === i ? val : b)); }
  function removeBullet(i: number) { setBullets((p) => p.filter((_, idx) => idx !== i)); }
  function moveBullet(i: number, dir: "up" | "down") {
    setBullets((p) => { const n = [...p], t = dir === "up" ? i - 1 : i + 1; [n[i], n[t]] = [n[t], n[i]]; return n; });
  }
  // Drag-and-drop reorder — alternative to the up/down chevrons, which stay as a fallback.
  function reorderBullets(from: number, to: number) {
    if (from === to) return;
    setBullets((p) => {
      const n = [...p];
      const [moved] = n.splice(from, 1);
      n.splice(to, 0, moved);
      return n;
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(formRef.current!);
    data.set("bullets", bullets.filter(Boolean).join("\n"));
    startTransition(async () => {
      await action(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  const descLabel = typeof cfg.description === "string" ? cfg.description : "Description";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
        <input type="hidden" name="categoryId" value={category.id} />

        <div className="space-y-1.5">
          <Label htmlFor="title">{cfg.titleLabel} *</Label>
          <Input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <p className="text-xs text-muted-foreground">This is the text rendered into your PDF export.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="displayTitle">Display Name</Label>
          <Input
            id="displayTitle"
            name="displayTitle"
            value={displayTitle}
            onChange={(e) => setDisplayTitle(e.target.value)}
            placeholder={title || "Same as above"}
          />
          <p className="text-xs text-muted-foreground">
            Optional. Only shown in the dashboard, to tell copies of this entry apart. Doesn&apos;t affect the PDF.
          </p>
        </div>

        {cfg.organizationLabel && (
          <div className="space-y-1.5">
            <Label htmlFor="organization">{cfg.organizationLabel}</Label>
            <Input id="organization" name="organization" value={organization} onChange={(e) => setOrganization(e.target.value)} />
          </div>
        )}

        {(cfg.location || cfg.dates) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cfg.location && (
              <div className="space-y-1.5">
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
            )}
            {cfg.dates && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" name="startDate" placeholder="e.g. Jan 2022" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" name="endDate" placeholder="e.g. Dec 2023 or Present" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </>
            )}
          </div>
        )}

        {cfg.description && (
          <div className="space-y-1.5">
            <Label htmlFor="description">{descLabel}</Label>
            <RichTextArea value={description} onChange={setDescription} rows={2} />
          </div>
        )}

        {cfg.bullets && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Bullet Points</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addBullet}>Add bullet</Button>
            </div>
            <div className="space-y-2">
              {bullets.map((bullet, i) => {
                const scoreResult = bulletScores[i];
                return (
                <div key={i} className="space-y-1">
                  <div
                    className={`flex gap-1.5 items-start rounded-md transition-opacity ${
                      draggedBulletIndex === i ? "opacity-40" : ""
                    } ${
                      dragOverBulletIndex === i && draggedBulletIndex !== null && draggedBulletIndex !== i
                        ? "ring-2 ring-primary/50"
                        : ""
                    }`}
                    onDragOver={(e) => {
                      if (draggedBulletIndex === null) return;
                      e.preventDefault();
                      if (dragOverBulletIndex !== i) setDragOverBulletIndex(i);
                    }}
                    onDragLeave={() => {
                      if (dragOverBulletIndex === i) setDragOverBulletIndex(null);
                    }}
                    onDrop={(e) => {
                      if (draggedBulletIndex === null) return;
                      e.preventDefault();
                      reorderBullets(draggedBulletIndex, i);
                      setDraggedBulletIndex(null);
                      setDragOverBulletIndex(null);
                    }}
                  >
                    <div
                      draggable
                      onDragStart={(e) => {
                        setDraggedBulletIndex(i);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDraggedBulletIndex(null);
                        setDragOverBulletIndex(null);
                      }}
                      className="mt-1.5 shrink-0 cursor-grab touch-none text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
                      aria-hidden="true"
                    >
                      <GripVertical className="size-3.5" />
                    </div>
                    <div className="flex flex-col mt-1.5 shrink-0">
                      <button type="button" onClick={() => moveBullet(i, "up")} disabled={i === 0} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
                        <ChevronUp className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => moveBullet(i, "down")} disabled={i === bullets.length - 1} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
                        <ChevronDown className="size-3.5" />
                      </button>
                    </div>
                    <span className="mt-2.5 text-muted-foreground text-xs select-none">•</span>
                    <RichTextArea value={bullet} onChange={(val) => updateBullet(i, val)} rows={2} placeholder="Bullet point..." className="flex-1" />
                    {bullets.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeBullet(i)} className="mt-1 text-muted-foreground hover:text-destructive shrink-0">Remove</Button>
                    )}
                  </div>
                  {scoreResult && (
                    <div className="pl-8 pr-2">
                      {"error" in scoreResult ? (
                        <p className="text-xs text-destructive">{scoreResult.error}</p>
                      ) : (
                        <BulletScoreBadge result={scoreResult} />
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        )}

        {(cfg.url || cfg.tagsLabel) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cfg.url && (
              <div className="space-y-1.5">
                <Label htmlFor="url">URL</Label>
                <Input id="url" name="url" type="url" placeholder="https://..." defaultValue={entry?.url ?? ""} />
              </div>
            )}
            {cfg.tagsLabel && (
              <div className="space-y-1.5">
                <Label htmlFor="tags">{cfg.tagsLabel}</Label>
                <Input id="tags" name="tags" placeholder="comma-separated" value={tags} onChange={(e) => setTags(e.target.value)} />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          {saved && <span className="text-sm text-green-600">✓ Saved</span>}
          <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : submitLabel}</Button>
        </div>
      </form>

      <div className="xl:sticky xl:top-20 space-y-3">
        {cfg.bullets && (
          <div className="flex items-center gap-2 px-1">
            <ScoreBubbleButton
              state={isScoringAll ? "loading" : overallScore}
              onClick={handleScoreAll}
              disabled={isScoringAll || !bullets.some((b) => b.trim())}
            />
            {overallScore && !isScoringAll && (
              "error" in overallScore ? (
                <span className="text-xs text-destructive">{overallScore.error}</span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {overallScore.legend[String(Math.min(2, Math.max(0, Math.round(overallScore.score))))]} · {confidenceWord(overallScore.confidence)}
                </span>
              )
            )}
          </div>
        )}
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Preview</p>
        <Card>
          <CardContent className="pt-5 pb-5 text-[13px] leading-snug space-y-2">
            <EntryPreview
              categorySlug={category.slug}
              title={title} organization={organization} location={location}
              startDate={startDate} endDate={endDate} description={description}
              bullets={bullets} tags={tags}
            />
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground px-1">Approximation of the PDF layout</p>
      </div>
    </div>
  );
}

type PreviewProps = {
  categorySlug: string;
  title: string; organization: string; location: string;
  startDate: string; endDate: string; description: string;
  bullets: string[]; tags: string;
};

function EntryPreview({ categorySlug, title, organization, location, startDate, endDate, description, bullets, tags }: PreviewProps) {
  const dateStr = [startDate, endDate].filter(Boolean).join(" – ");
  const filledBullets = bullets.filter(Boolean);
  const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
  const isEmpty = !title && !organization && !location && !startDate && !description && !filledBullets.length && !tagList.length;

  if (isEmpty) return <p className="text-muted-foreground text-xs text-center py-4">Fill in the fields to see a preview</p>;

  if (categorySlug === "skills") return (
    <div className="space-y-1">
      <span className="font-semibold">{title || <Ghost>Skill Category</Ghost>}</span>
      {tagList.length > 0 && <span className="text-muted-foreground">: {tagList.join(", ")}</span>}
      {description && <p className="text-muted-foreground text-xs mt-1">{renderRich(description)}</p>}
    </div>
  );

  if (categorySlug === "projects") return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold truncate">
          {title || <Ghost>Project Name</Ghost>}
          {tagList.length > 0 && <span className="font-normal text-muted-foreground"> | {tagList.join(", ")}</span>}
        </span>
        {dateStr && <span className="text-muted-foreground shrink-0 text-xs">{dateStr}</span>}
      </div>
      <BulletList bullets={filledBullets} />
    </div>
  );

  if (categorySlug === "education") return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold truncate">{organization || <Ghost>School</Ghost>}</span>
        {location && <span className="text-muted-foreground shrink-0 text-xs">{location}</span>}
      </div>
      <div className="flex items-baseline justify-between gap-2 text-muted-foreground">
        <span className="italic truncate">{title || <Ghost>Degree</Ghost>}</span>
        {dateStr && <span className="italic shrink-0 text-xs">{dateStr}</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold truncate">{title || <Ghost>Job Title</Ghost>}</span>
        {dateStr && <span className="text-muted-foreground shrink-0 text-xs">{dateStr}</span>}
      </div>
      {(organization || location) && (
        <div className="flex items-baseline justify-between gap-2 text-muted-foreground">
          <span className="italic truncate">{organization}</span>
          {location && <span className="italic shrink-0 text-xs">{location}</span>}
        </div>
      )}
      {description && <p className="text-muted-foreground mt-1">{renderRich(description)}</p>}
      <BulletList bullets={filledBullets} />
    </div>
  );
}

function BulletList({ bullets }: { bullets: string[] }) {
  if (!bullets.length) return null;
  return (
    <ul className="space-y-1 pl-3 mt-1">
      {bullets.map((b, i) => (
        <li key={i} className="flex gap-1.5"><span className="text-muted-foreground shrink-0">•</span><span>{renderRich(b)}</span></li>
      ))}
    </ul>
  );
}

function Ghost({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground/40 italic font-normal">{children}</span>;
}

// Parse **bold** and *italic* markers for the preview
function renderRich(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}
