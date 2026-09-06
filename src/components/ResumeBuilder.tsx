"use client";

import { useState, useTransition } from "react";
import type { Category, Entry, ResumeEntry } from "@prisma/client";
import { updateResumeEntries } from "@/app/resumes/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";

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
  const [downloading, startDownload] = useTransition();
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

  function save(): Promise<void> {
    return new Promise((resolve) => {
      startSave(async () => {
        await updateResumeEntries(resumeId, Array.from(selected));
        setSaved(true);
        resolve();
      });
    });
  }

  function handleDownload() {
    startDownload(async () => {
      await updateResumeEntries(resumeId, Array.from(selected));
      setSaved(true);
      window.open(`/api/pdf/${resumeId}`, "_blank");
    });
  }

  const entriesByCategory = categories
    .map((cat) => ({
      category: cat,
      entries: allEntries.filter((e) => e.categoryId === cat.id),
    }))
    .filter((g) => g.entries.length > 0);

  const isBusy = saving || downloading;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selected.size} {selected.size === 1 ? "entry" : "entries"} selected
        </p>
        <div className="flex items-center gap-2">
          {saved && !isBusy && (
            <span className="text-sm text-green-600">Saved</span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => save()}
            disabled={isBusy}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            size="sm"
            onClick={handleDownload}
            disabled={isBusy}
          >
            {downloading ? "Generating..." : "Download PDF"}
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
        entriesByCategory.map(({ category, entries }) => (
          <div key={category.id} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
              {category.name}
            </p>
            {entries.map((entry) => (
              <div
                key={entry.id}
                onClick={() => toggle(entry.id)}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors select-none ${
                  selected.has(entry.id)
                    ? "bg-muted/60 border-primary/40"
                    : "hover:bg-muted/30 border-border"
                }`}
              >
                <Checkbox
                  checked={selected.has(entry.id)}
                  onCheckedChange={() => toggle(entry.id)}
                  className="mt-0.5 pointer-events-none"
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
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
