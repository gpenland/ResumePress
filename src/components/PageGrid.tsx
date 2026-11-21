// Page scaffold for the "Nord Paper" layout: a dashed four-column grid drawn
// behind the page, a header band, and the body below it.
//
// The grid is purely decorative and sits behind everything, so anything with
// its own background (cards, cells, PageHeader's label boxes) covers it — the
// lines only show through open space. That's deliberate: lines running *under*
// text read as a collision, lines stopping at an opaque surface read as
// structure. Hidden below `lg`, where layouts collapse to one or two columns
// and four lines would no longer line up with anything.
//
// Opt-in per page rather than global: pages that haven't been laid out on
// the four-column grid would have their text crossing the lines.
const GRID_LINES = [0, 25, 50, 75, 100];

export default function PageGrid({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
        <div className="mx-auto h-full max-w-6xl px-4">
          <div className="relative h-full">
            {GRID_LINES.map((p) => (
              <span
                key={p}
                className="absolute inset-y-0 border-l border-dashed border-grid"
                // The last line is pulled in 1px so it sits under the right
                // border of a full-width cell instead of just outside it.
                style={{ left: p === 100 ? "calc(100% - 1px)" : `${p}%` }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="relative border-b border-dashed border-grid">
        <div className="mx-auto max-w-6xl px-4">{header}</div>
      </div>
      <div className="relative mx-auto max-w-6xl space-y-8 px-4 py-8">{children}</div>
    </div>
  );
}

/** Inner padding that puts text 24px inside its grid column — the one text edge every gridded surface uses. */
export const GRID_INSET = "px-4 lg:px-6";
