"use client";

import { useState, useTransition } from "react";
import type { Category, Entry, ResumeEntry } from "@prisma/client";
import { updateResumeEntries } from "@/app/resumes/actions";

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

  const entriesByCategory = categories.map((cat) => ({
    category: cat,
    entries: allEntries.filter((e) => e.categoryId === cat.id),
  })).filter((g) => g.entries.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {selected.size} {selected.size === 1 ? "entry" : "entries"} selected
        </p>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">Saved</span>}
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Selection"}
          </button>
        </div>
      </div>

      {entriesByCategory.length === 0 ? (
        <p className="text-sm text-zinc-400">
          No entries yet.{" "}
          <a href="/entries/new" className="text-blue-600 hover:underline">
            Add some entries
          </a>{" "}
          to start building.
        </p>
      ) : (
        entriesByCategory.map(({ category, entries }) => (
          <div key={category.id}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              {category.name}
            </h3>
            <div className="space-y-2">
              {entries.map((entry) => (
                <label
                  key={entry.id}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                    selected.has(entry.id)
                      ? "border-zinc-900 bg-zinc-50"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(entry.id)}
                    onChange={() => toggle(entry.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-800">{entry.title}</p>
                    {(entry.organization || entry.location || entry.startDate) && (
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {[entry.organization, entry.location].filter(Boolean).join(" · ")}
                        {entry.startDate && (
                          <span className="ml-2">
                            {entry.startDate}
                            {entry.endDate ? ` – ${entry.endDate}` : ""}
                          </span>
                        )}
                      </p>
                    )}
                    {entry.bullets.length > 0 && (
                      <p className="text-xs text-zinc-400 mt-1">
                        {entry.bullets.length} bullet{entry.bullets.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
