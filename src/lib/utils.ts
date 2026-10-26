export { cn } from "cn"

// Shared styling for plain <select> elements, used where a full Select
// component isn't needed (simple name-based form fields, tight inline
// contexts like a kanban card). Several call sites had each invented their
// own classes and drifted apart (rounded-md vs rounded-lg, h-9 vs h-8, no
// focus ring) — this is the one definition every native select should use,
// so they all read as the same control.
export function nativeSelectClassName(size: "sm" | "default" = "default"): string {
  return size === "sm"
    ? "h-7 rounded-lg border border-input bg-transparent px-2 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed"
    : "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed"
}
