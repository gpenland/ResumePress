"use client";

import { useRef, useState } from "react";
import type { Category, Entry } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  categories: Category[];
  entry?: Entry;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
};

export default function EntryForm({ categories, entry, action, submitLabel }: Props) {
  const [bullets, setBullets] = useState<string[]>(
    entry?.bullets.length ? entry.bullets : [""]
  );
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? "");

  function addBullet() {
    setBullets((prev) => [...prev, ""]);
  }

  function updateBullet(index: number, value: string) {
    setBullets((prev) => prev.map((b, i) => (i === index ? value : b)));
  }

  function removeBullet(index: number) {
    setBullets((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="bullets" value={bullets.filter(Boolean).join("\n")} />
      <input type="hidden" name="categoryId" value={categoryId} />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title *</Label>
          <Input id="title" name="title" defaultValue={entry?.title} required />
        </div>
        <div className="space-y-1.5">
          <Label>Category *</Label>
          <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")} required>
            <SelectTrigger>
              <span className="flex-1 text-left text-sm">
                {categoryId
                  ? categories.find((c) => c.id === categoryId)?.name
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
          <Input id="organization" name="organization" defaultValue={entry?.organization ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" defaultValue={entry?.location ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" name="startDate" placeholder="e.g. Jan 2022" defaultValue={entry?.startDate ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">End Date</Label>
          <Input id="endDate" name="endDate" placeholder="e.g. Dec 2023 or Present" defaultValue={entry?.endDate ?? ""} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={entry?.description ?? ""}
          rows={3}
          placeholder="Brief summary..."
          className="resize-y"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Bullet Points</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addBullet}>
            Add bullet
          </Button>
        </div>
        <div className="space-y-2">
          {bullets.map((bullet, i) => (
            <div key={i} className="flex gap-2 items-start">
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
                  className="mt-1 text-muted-foreground hover:text-destructive"
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
          <Input id="url" name="url" type="url" placeholder="https://..." defaultValue={entry?.url ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tags">
            Tags <span className="text-muted-foreground font-normal">(comma-separated)</span>
          </Label>
          <Input
            id="tags"
            name="tags"
            placeholder="React, TypeScript, Node.js"
            defaultValue={entry?.tags.join(", ") ?? ""}
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
