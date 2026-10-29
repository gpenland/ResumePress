// Deterministic date/time formatting, pure and client-safe (no runtime
// import of @/lib/prisma — see applicationsShared.ts's header comment for
// why that matters for client components).
//
// Pins locale ("en-US") and timeZone ("UTC") explicitly rather than relying
// on Intl.DateTimeFormat's defaults, which resolve to the CALLING
// environment's own locale/timezone. A Client Component renders twice —
// once on the server for the initial HTML (e.g. UTC in a Docker container),
// then again in the browser to hydrate (the user's local timezone/locale)
// — so a date formatted with the runtime's defaults can produce different
// text on each pass for any value near a day boundary. React treats that as
// a hydration mismatch (error #418) severe enough to discard and
// regenerate that DOM subtree; if that subtree happens to hold an
// already-open dropdown/menu (e.g. mid-interaction with an unrelated
// filter), the UI library's own portal/positioning state desyncs from the
// now-different DOM and throws its own error on top of React's. That
// cascade — not anything wrong with the filter itself — is what crashed the
// applications page when using the recruiting-cycle filter (GitHub issue
// #106 follow-up): the filter just happened to be the thing that triggered
// React to reconcile a nearby `formatShortDate` call that had been silently
// mismatched since before the filter ever existed.
export function formatShortDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function formatShortDateTime(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
