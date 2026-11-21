import StatusDot from "@/components/applications/StatusDot";

// Dot-plus-label rather than a tinted pill: quieter in dense lists, and the
// dot carries the same per-status tone (applicationsShared.ts) as the
// dashboard bars and the Sankey.
export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium whitespace-nowrap">
      <StatusDot status={status} />
      {/* The status itself already calls it "Ghosted" — the emoji just winks at a word the app's own taxonomy picked. */}
      {status === "Ghosted" ? "👻 Ghosted" : status}
    </span>
  );
}
