export { cn } from "cn"

// Shared styling for plain <select> elements, used where a full Select
// component isn't needed (simple name-based form fields, tight inline
// contexts like a kanban card). Several call sites had each invented their
// own classes and drifted apart (rounded-md vs rounded-lg, h-9 vs h-8, no
// focus ring) — this is the one definition every native select should use,
// so they all read as the same control.
// A native <select> sizes itself to its longest option, so one long label,
// contact or application name would push it past a narrow container (e.g.
// the email page's side panel). max-w-full caps it at its container; the
// browser then truncates the shown option instead.
export function nativeSelectClassName(size: "sm" | "default" = "default"): string {
  return size === "sm"
    ? "max-w-full min-w-0 h-7 rounded-lg border border-input bg-transparent px-2 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed"
    : "max-w-full min-w-0 h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed"
}
