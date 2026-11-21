"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Category, Entry, ResumeEntry } from "@prisma/client";
import { updateResumeEntries } from "@/app/(protected)/resumes/actions";
import { fetchResumePdf, triggerBlobDownload } from "@/lib/pdfDownloadClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronUp, ChevronDown, GripVertical, Pencil, X } from "lucide-react";
import { Panel } from "@/components/Panel";
import { GRID_INSET } from "@/components/PageGrid";
import { cn } from "@/lib/utils";

type EntryWithCategory = Entry & { category: Category };

type Props = {
  resumeId: string;
  allEntries: EntryWithCategory[];
  selectedEntries: ResumeEntry[];
  categories: Category[];
  /** Shown at the top of the sticky right-hand column, above the preview. */
  identityPanel: React.ReactNode;
};

export default function ResumeBuilder({ resumeId, allEntries, selectedEntries, categories, identityPanel }: Props) {
  // Ordered array of selected entry IDs — index determines PDF order within categories
  const [selectedOrder, setSelectedOrder] = useState<string[]>(
    selectedEntries
      .sort((a, b) => a.order - b.order)
      .map((re) => re.entryId)
  );

  // What's actually saved, to tell whether the current selection has
  // unsaved changes.
  const [savedOrder, setSavedOrder] = useState<string[]>(selectedOrder);
  const isDirty = selectedOrder.join() !== savedOrder.join();

  const [saving, startSave] = useTransition();
  const [downloading, startDownload] = useTransition();
  const [previewing, startPreview] = useTransition();
  const [saved, setSaved] = useState(false);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const selectedSet = new Set(selectedOrder);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  function toggle(entryId: string) {
    setSelectedOrder((prev) => {
      if (prev.includes(entryId)) return prev.filter((id) => id !== entryId);
      return [...prev, entryId];
    });
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
  }

  // Drag-and-drop reorder: move draggedEntryId to targetEntryId's position,
  // within the subset of selected entries belonging to categoryId.
  function reorderInCategory(categoryId: string, draggedEntryId: string, targetEntryId: string) {
    if (draggedEntryId === targetEntryId) return;
    setSelectedOrder((prev) => {
      const catIds = new Set(
        allEntries.filter((e) => e.categoryId === categoryId).map((e) => e.id)
      );
      const selectedInCat = prev.filter((id) => catIds.has(id));
      const fromIdx = selectedInCat.indexOf(draggedEntryId);
      const toIdx = selectedInCat.indexOf(targetEntryId);
      if (fromIdx === -1 || toIdx === -1) return prev;

      const reordered = [...selectedInCat];
      reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, draggedEntryId);

      // Splice the reordered within-category sequence back into the full list,
      // leaving every other category's entries untouched in place.
      let catPtr = 0;
      return prev.map((id) => (catIds.has(id) ? reordered[catPtr++] : id));
    });
  }

  async function persistSelection() {
    const order = selectedOrder;
    await updateResumeEntries(resumeId, order);
    setSavedOrder(order);
    setSaved(true);
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    savedTimeoutRef.current = setTimeout(() => setSaved(false), 2500);
  }

  function handleSave() {
    startSave(persistSelection);
  }

  function handleDownload() {
    startDownload(async () => {
      setDownloadError(null);
      await persistSelection();
      const result = await fetchResumePdf(`/api/pdf/${resumeId}`);
      if (!result.ok) {
        setDownloadError(result.error);
        return;
      }
      triggerBlobDownload(result.blobUrl, result.filename);
    });
  }

  function handlePreview() {
    startPreview(async () => {
      setPreviewError(null);
      await persistSelection();
      // Inline mode asks the PDF route for Content-Disposition: inline, which
      // only affects the filename a browser would suggest — we always render
      // the fetched blob in the <iframe> below regardless.
      const result = await fetchResumePdf(`/api/pdf/${resumeId}?inline=1&t=${Date.now()}`);
      if (!result.ok) {
        setPreviewError(result.error);
        return;
      }
      setPreviewUrl(result.blobUrl);
    });
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }

  const isBusy = saving || downloading || previewing;

  const entriesByCategory = categories
    .map((cat) => ({
      category: cat,
      entries: allEntries.filter((e) => e.categoryId === cat.id),
    }))
    .filter((g) => g.entries.length > 0);

  const toolbar = (
    <>
      <span className={cn("text-xs", isDirty ? "font-medium text-foreground" : "text-muted-foreground")} aria-live="polite">
        {isDirty ? "Unsaved changes" : saved && !isBusy ? "Saved" : "All changes saved"}
      </span>
      <Button variant={isDirty ? "default" : "outline"} onClick={handleSave} disabled={isBusy || !isDirty}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </>
  );

  return (
    // List on the left, identity and the compiled preview on the right —
    // sticky, so the preview stays in view while you work down the list.
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
      <Panel
        title={`${selectedOrder.length} ${selectedOrder.length === 1 ? "entry" : "entries"} selected`}
        actions={toolbar}
      >
        {entriesByCategory.length === 0 ? (
          <p className={cn("py-10 text-center text-sm text-muted-foreground", GRID_INSET)}>
            No entries yet.{" "}
            <Link href="/entries/new" className="text-primary underline underline-offset-4">
              Add some entries
            </Link>{" "}
            to start building.
          </p>
        ) : (
          <div className={cn("space-y-5 pt-2 pb-4", GRID_INSET)}>
            {entriesByCategory.map(({ category, entries }) => {
              // Split into selected (preserving their order) and unselected
              const selectedInCat = selectedOrder.filter((id) => entries.some((e) => e.id === id));
              const unselectedInCat = entries.filter((e) => !selectedSet.has(e.id));
              const orderedEntries = [
                ...selectedInCat.map((id) => entries.find((e) => e.id === id)!),
                ...unselectedInCat,
              ];

              return (
                <div key={category.id} className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{category.name}</p>

                  {orderedEntries.map((entry) => {
                    const isSelected = selectedSet.has(entry.id);
                    const posInCat = selectedInCat.indexOf(entry.id);
                    const isFirst = posInCat === 0;
                    const isLast = posInCat === selectedInCat.length - 1;

                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          "flex items-start gap-2 border px-2 py-2.5 transition-colors",
                          isSelected ? "border-primary/30 bg-muted/60" : "cursor-pointer border-border hover:bg-muted/30",
                          draggedId === entry.id && "opacity-40",
                          isSelected && dragOverId === entry.id && draggedId && draggedId !== entry.id && "ring-2 ring-primary/50"
                        )}
                        onClick={!isSelected ? () => toggle(entry.id) : undefined}
                        onDragOver={(e) => {
                          if (!isSelected || !draggedId) return;
                          e.preventDefault();
                          if (dragOverId !== entry.id) setDragOverId(entry.id);
                        }}
                        onDragLeave={() => {
                          if (dragOverId === entry.id) setDragOverId(null);
                        }}
                        onDrop={(e) => {
                          if (!isSelected || !draggedId) return;
                          e.preventDefault();
                          reorderInCategory(category.id, draggedId, entry.id);
                          setDraggedId(null);
                          setDragOverId(null);
                        }}
                      >
                        {/* Drag handle. The slot is always there (just empty
                            when unselected) so ticking an entry doesn't shift
                            its text sideways. */}
                        <div
                          draggable={isSelected}
                          onDragStart={(e) => {
                            e.stopPropagation();
                            setDraggedId(entry.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            setDraggedId(null);
                            setDragOverId(null);
                          }}
                          onClick={(e) => isSelected && e.stopPropagation()}
                          className={cn(
                            "w-4 shrink-0 self-center text-muted-foreground/60",
                            isSelected && "cursor-grab touch-none hover:text-muted-foreground active:cursor-grabbing"
                          )}
                          aria-hidden="true"
                        >
                          {isSelected && <GripVertical className="size-4" />}
                        </div>

                        {/* Checkbox */}
                        <div
                          className="mt-0.5 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(entry.id);
                          }}
                        >
                          <Checkbox checked={isSelected} onCheckedChange={() => toggle(entry.id)} className="pointer-events-none" />
                        </div>

                        {/* Entry info */}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight">{entry.displayTitle || entry.title}</p>
                          {entry.displayTitle && entry.displayTitle !== entry.title && (
                            <p className="mt-0.5 text-xs italic text-muted-foreground/80">PDF text: &ldquo;{entry.title}&rdquo;</p>
                          )}
                          {(entry.organization || entry.location || entry.startDate) && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {[
                                entry.organization,
                                entry.location,
                                entry.startDate && `${entry.startDate}${entry.endDate ? ` – ${entry.endDate}` : ""}`,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                          {entry.bullets.length > 0 && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {entry.bullets.length} bullet{entry.bullets.length !== 1 ? "s" : ""}
                            </p>
                          )}
                        </div>

                        {/* Edit entry */}
                        <Link
                          href={`/entries/${entry.id}/edit?resumeId=${resumeId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 shrink-0 self-center p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
                          aria-label={`Edit ${entry.displayTitle || entry.title}`}
                        >
                          <Pencil className="size-3.5" />
                        </Link>

                        {/* Reorder controls — slot always reserved, like the handle. */}
                        <div className="flex w-5 shrink-0 flex-col self-center">
                          {isSelected && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveInCategory(entry.id, category.id, "up");
                                }}
                                disabled={isFirst}
                                className="p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-20"
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
                                className="p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-20"
                                aria-label="Move down"
                              >
                                <ChevronDown className="size-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* The column stretches to the list's height so the preview inside it
          can stick while the list scrolls; identity scrolls away above it,
          and the preview is sized to fit the screen so its bottom is never
          out of reach. */}
      <div className="space-y-8 lg:self-stretch">
        {identityPanel}

        <div className="lg:sticky lg:top-20">
        <Panel
          title="Preview"
          actions={
            <>
              {previewUrl && (
                <Button variant="ghost" size="icon" onClick={closePreview} aria-label="Close preview">
                  <X />
                </Button>
              )}
              <Button variant="outline" onClick={handlePreview} disabled={isBusy}>
                {previewing ? "Compiling…" : previewUrl ? "Refresh" : "Preview"}
              </Button>
              <Button onClick={handleDownload} disabled={isBusy}>
                {downloading ? "Generating…" : "Download PDF"}
              </Button>
            </>
          }
        >
          {(downloadError || previewError) && (
            <p className={cn("pb-2 text-sm text-destructive", GRID_INSET)}>{downloadError || previewError}</p>
          )}
          {previewUrl ? (
            <iframe src={previewUrl} title="Resume PDF preview" className="h-[70vh] w-full border-t lg:h-[calc(100vh-11rem)]" />
          ) : (
            <p className={cn("pb-4 text-sm text-muted-foreground", GRID_INSET)}>
              Compile the resume to see the PDF here. Previewing or downloading saves your selection first.
            </p>
          )}
        </Panel>
        </div>
      </div>
    </div>
  );
}
