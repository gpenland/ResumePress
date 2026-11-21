"use client";

import { useEffect, useState } from "react";
import { formatShortDateTime } from "@/lib/dateFormat";

// A timestamp in the viewer's own timezone ("Nov 11, 2026, 6:42 PM").
//
// The server can't know the viewer's timezone, and formatting with the
// runtime's defaults would render different text on the server and in the
// browser — a hydration mismatch (see dateFormat.ts for the crash that
// caused). So the first render, on both sides, is the deterministic UTC
// string, and the local one swaps in after mount.
export default function LocalDateTime({ value, className }: { value: Date | string; className?: string }) {
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    setLocal(
      new Date(value).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    );
  }, [value]);

  return (
    <time dateTime={new Date(value).toISOString()} className={className}>
      {local ?? formatShortDateTime(value)}
    </time>
  );
}
