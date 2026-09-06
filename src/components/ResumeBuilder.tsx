"use client";

import { useState, useTransition } from "react";
import type { Category, Entry, ResumeEntry } from "@prisma/client";
import { updateResumeEntries } from "@/app/resumes/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type EntryWithCategory = Entry & { category: Category };

type Props = {
  resumeId: string;
  allEntries: EntryWithCategory[];
  selectedEntries: ResumeEntry[];
  categories: Category[];
};

export default function ResumeBuilder({ resumeId, allEntries, selectedEntries, categories }: Props) {
  const initialSelected = new Set(selectedEntries.map((re) => re.entryId));
  const [selected, setSelected] = useState<Set<string>>(initialSelected);
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggle(entryId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
    setSaved(false);
  }

  function save() {
    startSave(async () => {
      await updateResumeEntries(resumeId, Array.from(selected));
      setSaved(true);
    });
  }

  const entriesByCategory = categories
    .map((cat) => ({
      category: cat,
      entries: allEntries.filter((e) => e.categoryId === cat.id),
    }))
    .filter((g) => g.entries.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selected.size} {selected.size === 1 ? "entry" : "entries"} selected
        </p>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">Saved</span>}
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? "Saving..." : "Save Selection"}
          </Button>
        </div>
      </div>

      {entriesByCategory.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No entries yet.{" "}
              <a href="/entries/new" className="text-primary underline underline-offset-4">
                Add some entries
              </a>{" "}
              to start building.
            </p>
          </CardContent>
        </Card>
      ) : (
        entriesByCategory.map(({ category, entries }, gi) => (
          <div key={category.id} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
              {category.name}
            </p>
            {entries.map((entry) => (
              <label
                key={entry.id}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  selected.has(entry.id) ? "bg-muted/60 border-border" : "hover:bg-muted/30"
                }`}
              >
                <Checkbox
                  checked={selected.has(entry.id)}
                  onCheckedChange={() => toggle(entry.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{entry.title}</p>
                  {(entry.organization || entry.location || entry.startDate) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[entry.organization, entry.location].filter(Boolean).join(" · ")}
                      {entry.startDate && (
                        <span className="ml-2">
                          {entry.startDate}{entry.endDate ? ` – ${entry.endDate}` : ""}
                        </span>
                      )}
                    </p>
                  )}
                  {entry.bullets.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {entry.bullets.length} bullet{entry.bullets.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
