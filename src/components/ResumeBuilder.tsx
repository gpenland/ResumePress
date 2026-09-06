"use client";

import { useState, useTransition } from "react";
import type { Category, Entry, ResumeEntry } from "@prisma/client";
import { updateResumeEntries } from "@/app/resumes/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronUp, ChevronDown } from "lucide-react";

type EntryWithCategory = Entry & { category: Category };

type Props = {
  resumeId: string;
  allEntries: EntryWithCategory[];
  selectedEntries: ResumeEntry[];
  categories: Category[];
};

export default function ResumeBuilder({ resumeId, allEntries, selectedEntries, categories }: Props) {
  // Ordered array of selected entry IDs — index determines PDF order within categories
  const [selectedOrder, setSelectedOrder] = useState<string[]>(
    selectedEntries
      .sort((a, b) => a.order - b.order)
      .map((re) => re.entryId)
  );

  const [saving, startSave] = useTransition();
  const [downloading, startDownload] = useTransition();
  const [saved, setSaved] = useState(false);

  const selectedSet = new Set(selectedOrder);

  function toggle(entryId: string) {
    setSelectedOrder((prev) => {
      if (prev.includes(entryId)) return prev.filter((id) => id !== entryId);
      return [...prev, entryId];
    });
    setSaved(false);
  }

  // Move entryId up or down among the selected entries within its category
  function moveInCategory(entryId: string, categoryId: string, dir: "up" | "down") {
    setSelectedOrder((prev) => {
      const catIds = new Set(
        allEntries.filter((e) => e.categoryId === categoryId).map((e) => e.id)
      );
      const selectedInCat = prev.filter((id) => catIds.has(id));
      const posInCat = selectedInCat.indexOf(entryId);

      if (dir === "up" && posInCat <= 0) return prev;
      if (dir === "down" && posInCat >= selectedInCat.length - 1) return prev;

      const swapId =
        dir === "up" ? selectedInCat[posInCat - 1] : selectedInCat[posInCat + 1];

      const next = [...prev];
      const idxA = next.indexOf(entryId);
      const idxB = next.indexOf(swapId);
      [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
      return next;
    });
    setSaved(false);
  }

  async function persistSelection() {
    await updateResumeEntries(resumeId, selectedOrder);
    setSaved(true);
  }

  function handleSave() {
    startSave(persistSelection);
  }

  function handleDownload() {
    startDownload(async () => {
      await persistSelection();
      window.open(`/api/pdf/${resumeId}`, "_blank");
    });
  }

  const isBusy = saving || downloading;

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
          {selectedOrder.length}{" "}
          {selectedOrder.length === 1 ? "entry" : "entries"} selected
        </p>
        <div className="flex items-center gap-2">
          {saved && !isBusy && (
            <span className="text-sm text-green-600">Saved</span>
          )}
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isBusy}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={isBusy}>
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
        entriesByCategory.map(({ category, entries }) => {
          // Split into selected (preserving their order) and unselected
          const selectedInCat = selectedOrder.filter((id) =>
            entries.some((e) => e.id === id)
          );
          const unselectedInCat = entries.filter(
            (e) => !selectedSet.has(e.id)
          );
          const orderedEntries = [
            ...selectedInCat.map((id) => entries.find((e) => e.id === id)!),
            ...unselectedInCat,
          ];

          return (
            <div key={category.id} className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                {category.name}
              </p>

              {orderedEntries.map((entry) => {
                const isSelected = selectedSet.has(entry.id);
                const posInCat = selectedInCat.indexOf(entry.id);
                const isFirst = posInCat === 0;
                const isLast = posInCat === selectedInCat.length - 1;

                return (
                  <div
                    key={entry.id}
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 transition-colors ${
                      isSelected
                        ? "bg-muted/60 border-primary/30"
                        : "hover:bg-muted/30 border-border cursor-pointer"
                    }`}
                    onClick={!isSelected ? () => toggle(entry.id) : undefined}
                  >
                    {/* Checkbox */}
                    <div
                      className="mt-0.5 shrink-0"
                      onClick={(e) => { e.stopPropagation(); toggle(entry.id); }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggle(entry.id)}
                        className="pointer-events-none"
                      />
                    </div>

                    {/* Entry info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{entry.title}</p>
                      {(entry.organization || entry.location || entry.startDate) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[entry.organization, entry.location]
                            .filter(Boolean)
                            .join(" · ")}
                          {entry.startDate && (
                            <span className="ml-2">
                              {entry.startDate}
                              {entry.endDate ? ` – ${entry.endDate}` : ""}
                            </span>
                          )}
                        </p>
                      )}
                      {entry.bullets.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {entry.bullets.length} bullet
                          {entry.bullets.length !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>

                    {/* Reorder controls — only for selected entries */}
                    {isSelected && (
                      <div className="flex flex-col shrink-0 self-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveInCategory(entry.id, category.id, "up");
                          }}
                          disabled={isFirst}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                          aria-label="Move up"
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveInCategory(entry.id, category.id, "down");
                          }}
                          disabled={isLast}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                          aria-label="Move down"
                        >
                          <ChevronDown className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}
