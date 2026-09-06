"use client";

import { useState } from "react";
import type { Category, Entry } from "@prisma/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  categories: Category[];
  entry?: Entry;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
};

export default function EntryForm({ categories, entry, action, submitLabel }: Props) {
  const [title, setTitle] = useState(entry?.title ?? "");
  const [organization, setOrganization] = useState(entry?.organization ?? "");
  const [location, setLocation] = useState(entry?.location ?? "");
  const [startDate, setStartDate] = useState(entry?.startDate ?? "");
  const [endDate, setEndDate] = useState(entry?.endDate ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [tags, setTags] = useState(entry?.tags.join(", ") ?? "");
  const [bullets, setBullets] = useState<string[]>(
    entry?.bullets.length ? entry.bullets : [""]
  );
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? "");

  const selectedCategory = categories.find((c) => c.id === categoryId);

  function addBullet() {
    setBullets((prev) => [...prev, ""]);
  }

  function updateBullet(index: number, value: string) {
    setBullets((prev) => prev.map((b, i) => (i === index ? value : b)));
  }

  function removeBullet(index: number) {
    setBullets((prev) => prev.filter((_, i) => i !== index));
  }

  function moveBullet(index: number, dir: "up" | "down") {
    setBullets((prev) => {
      const next = [...prev];
      const target = dir === "up" ? index - 1 : index + 1;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="grid grid-cols-[1fr_340px] gap-6 items-start">
      {/* ── Form ── */}
      <form action={action} className="space-y-5">
        <input type="hidden" name="bullets" value={bullets.filter(Boolean).join("\n")} />
        <input type="hidden" name="categoryId" value={categoryId} />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")} required>
              <SelectTrigger>
                <span className="flex-1 text-left text-sm">
                  {categoryId
                    ? selectedCategory?.name
                    : <span className="text-muted-foreground">Select category</span>}
                </span>
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="organization">Organization / Employer</Label>
            <Input
              id="organization"
              name="organization"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              name="startDate"
              placeholder="e.g. Jan 2022"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              name="endDate"
              placeholder="e.g. Dec 2023 or Present"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Brief summary..."
            className="resize-y"
          />
        </div>

        {/* Bullets */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Bullet Points</Label>
            <Button type="button" variant="ghost" size="sm" onClick={addBullet}>
              Add bullet
            </Button>
          </div>
          <div className="space-y-2">
            {bullets.map((bullet, i) => (
              <div key={i} className="flex gap-1.5 items-start">
                {/* reorder */}
                <div className="flex flex-col mt-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveBullet(i, "up")}
                    disabled={i === 0}
                    className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                    aria-label="Move up"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBullet(i, "down")}
                    disabled={i === bullets.length - 1}
                    className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                    aria-label="Move down"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </div>
                <span className="mt-2.5 text-muted-foreground text-xs select-none">•</span>
                <Textarea
                  value={bullet}
                  onChange={(e) => updateBullet(i, e.target.value)}
                  rows={2}
                  placeholder="Bullet point..."
                  className="flex-1 resize-y"
                />
                {bullets.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBullet(i)}
                    className="mt-1 text-muted-foreground hover:text-destructive shrink-0"
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              name="url"
              type="url"
              placeholder="https://..."
              defaultValue={entry?.url ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tags">
              Tags{" "}
              <span className="text-muted-foreground font-normal">(comma-separated)</span>
            </Label>
            <Input
              id="tags"
              name="tags"
              placeholder="React, TypeScript, Node.js"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>

      {/* ── Preview ── */}
      <div className="sticky top-20 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Preview
        </p>
        <Card className="text-[13px] leading-snug">
          <CardContent className="pt-5 pb-5 space-y-2">
            <EntryPreview
              title={title}
              organization={organization}
              location={location}
              startDate={startDate}
              endDate={endDate}
              description={description}
              bullets={bullets}
              tags={tags}
              categorySlug={selectedCategory?.slug ?? ""}
            />
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground px-1">
          Approximation of how this entry appears in the PDF
        </p>
      </div>
    </div>
  );
}

type PreviewProps = {
  title: string;
  organization: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
  bullets: string[];
  tags: string;
  categorySlug: string;
};

function EntryPreview({
  title,
  organization,
  location,
  startDate,
  endDate,
  description,
  bullets,
  tags,
  categorySlug,
}: PreviewProps) {
  const dateStr = [startDate, endDate].filter(Boolean).join(" – ");
  const filledBullets = bullets.filter(Boolean);
  const tagList = tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const isEmpty = !title && !organization && !location && !startDate && !description && filledBullets.length === 0;

  if (isEmpty) {
    return (
      <p className="text-muted-foreground text-xs text-center py-4">
        Fill in the fields to see a preview
      </p>
    );
  }

  // Skills: flat tag / description list
  if (categorySlug === "skills") {
    return (
      <div className="space-y-1">
        <div className="flex gap-1 flex-wrap">
          <span className="font-semibold">{title || <Placeholder>Title</Placeholder>}</span>
          {tagList.length > 0 && (
            <span className="text-muted-foreground">— {tagList.join(", ")}</span>
          )}
        </div>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
    );
  }

  // Projects
  if (categorySlug === "projects") {
    return (
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-semibold truncate">
            {title || <Placeholder>Title</Placeholder>}
            {tagList.length > 0 && (
              <span className="font-normal text-muted-foreground"> | {tagList.join(", ")}</span>
            )}
          </div>
          {dateStr && <span className="text-muted-foreground shrink-0 text-xs">{dateStr}</span>}
        </div>
        {description && <p className="text-muted-foreground">{description}</p>}
        {filledBullets.length > 0 && (
          <ul className="space-y-1 pl-3">
            {filledBullets.map((b, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-muted-foreground shrink-0">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Experience / Education / custom — subheading layout
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold truncate">
          {title || <Placeholder>Title</Placeholder>}
        </span>
        {dateStr && <span className="text-muted-foreground shrink-0 text-xs">{dateStr}</span>}
      </div>
      {(organization || location) && (
        <div className="flex items-baseline justify-between gap-2 text-muted-foreground">
          <span className="italic truncate">
            {organization || <Placeholder>Organization</Placeholder>}
          </span>
          {location && <span className="italic shrink-0 text-xs">{location}</span>}
        </div>
      )}
      {description && <p className="text-muted-foreground mt-1">{description}</p>}
      {filledBullets.length > 0 && (
        <ul className="space-y-1 pl-3 mt-1">
          {filledBullets.map((b, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="text-muted-foreground shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground/50 italic">{children}</span>;
}
