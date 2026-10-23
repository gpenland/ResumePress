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
          {versions.map((v) => {
            const data = v.data as SnapshotData;
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
                </button>
                {isExpanded && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2 ml-1">
                    {FIELD_LABELS.map(([key, label]) => (
                      <div key={key}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm mt-0.5 whitespace-pre-wrap">{formatValue(data[key])}</p>
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
