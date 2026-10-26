"use client";

import { useState } from "react";
import type { EntryVersion } from "@prisma/client";
import { Button } from "@/components/ui/button";

type SnapshotData = {
  title: string;
  displayTitle: string | null;
  organization: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  url: string | null;
  bullets: string[];
  tags: string[];
};

const FIELD_LABELS: Array<[keyof SnapshotData, string]> = [
  ["title", "Title"],
  ["displayTitle", "Display title"],
  ["organization", "Organization"],
  ["location", "Location"],
  ["startDate", "Start date"],
  ["endDate", "End date"],
  ["description", "Description"],
  ["url", "URL"],
  ["bullets", "Bullets"],
  ["tags", "Tags"],
];

function formatValue(v: string | string[] | null): string {
  if (v === null || v === "") return "—";
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.join("; ");
  return v;
}

function valuesEqual(a: string | string[] | null, b: string | string[] | null): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const aArr = Array.isArray(a) ? a : [];
    const bArr = Array.isArray(b) ? b : [];
    return aArr.length === bArr.length && aArr.every((v, i) => v === bArr[i]);
  }
  return a === b;
}

// Which fields actually changed between this snapshot and the one right
// before it in time. `versions` is fetched newest-first, so "before" is the
// NEXT array index, not the previous one. With no earlier snapshot to
// compare against (the oldest version, i.e. the entry's state at its first-
// ever edit), every field counts as "changed" — there's nothing to diff
// against, so the full snapshot is shown instead.
function changedFields(current: SnapshotData, previous: SnapshotData | null): Set<keyof SnapshotData> {
  if (!previous) return new Set(FIELD_LABELS.map(([key]) => key));
  const changed = new Set<keyof SnapshotData>();
  for (const [key] of FIELD_LABELS) {
    if (!valuesEqual(current[key], previous[key])) changed.add(key);
  }
  return changed;
}

export default function EntryHistory({ versions }: { versions: EntryVersion[] }) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (versions.length === 0) return null;

  return (
    <div className="mt-6 border-t pt-4">
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide" : "Show"} history ({versions.length})
      </Button>

      {open && (
        <div className="mt-2 space-y-2">
          {versions.map((v, i) => {
            const data = v.data as SnapshotData;
            // versions is newest-first, so the version "before" this one in
            // time is the NEXT entry in the array, not the previous one.
            const previous = (versions[i + 1]?.data as SnapshotData | undefined) ?? null;
            const changed = changedFields(data, previous);
            const fieldsToShow = FIELD_LABELS.filter(([key]) => changed.has(key));
            const isExpanded = expandedId === v.id;

            return (
              <div key={v.id} className="text-sm border-b last:border-0 pb-2">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : v.id)}
                  className="flex items-center gap-2 w-full text-left py-1"
                >
                  <span className="text-muted-foreground text-xs w-40 shrink-0">
                    {new Date(v.createdAt).toLocaleString()}
                  </span>
                  <span className="truncate">{data.title}</span>
                  {previous && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {fieldsToShow.length === 0
                        ? "no field changes"
                        : `${fieldsToShow.length} field${fieldsToShow.length === 1 ? "" : "s"} changed`}
                    </span>
                  )}
                </button>
                {isExpanded && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2 ml-1">
                    {!previous && (
                      <p className="col-span-full text-xs text-muted-foreground italic">
                        Earliest recorded version — showing the full snapshot.
                      </p>
                    )}
                    {fieldsToShow.map(([key, label]) => (
                      <div key={key}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        {previous ? (
                          <>
                            <p className="text-sm mt-0.5 whitespace-pre-wrap text-muted-foreground line-through">
                              {formatValue(previous[key])}
                            </p>
                            <p className="text-sm whitespace-pre-wrap">{formatValue(data[key])}</p>
                          </>
                        ) : (
                          <p className="text-sm mt-0.5 whitespace-pre-wrap">{formatValue(data[key])}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
