import { cn } from "@/lib/utils";
import { APPLICATION_STATUSES } from "@/lib/applicationsShared";
import type { StatusFlowLink } from "@/lib/applications";

// Same semantic colors as StatusBadge, as `fill-*` utilities instead of `bg-*`/`text-*`.
const STATUS_FILL: Record<string, string> = {
  Start: "fill-slate-400 dark:fill-slate-500",
  Applied: "fill-blue-500 dark:fill-blue-400",
  OA: "fill-violet-500 dark:fill-violet-400",
  Interviewing: "fill-amber-500 dark:fill-amber-400",
  Offer: "fill-emerald-500 dark:fill-emerald-400",
  Rejected: "fill-destructive",
  Ghosted: "fill-muted-foreground",
};
const DEFAULT_FILL = "fill-slate-400 dark:fill-slate-500";

// Top-to-bottom node order within a column — mirrors the kanban board's
// column order, with "Start" (the synthetic pre-application-history node)
// first. Any custom/unrecognized status sorts after, alphabetically.
const STATUS_ORDER = ["Start", ...APPLICATION_STATUSES];

function rank(name: string): number {
  const i = STATUS_ORDER.indexOf(name);
  return i === -1 ? STATUS_ORDER.length : i;
}

function compareNodes(a: string, b: string): number {
  return rank(a) - rank(b) || a.localeCompare(b);
}

function nodeValue(name: string, links: StatusFlowLink[]): number {
  let inflow = 0;
  let outflow = 0;
  for (const l of links) {
    if (l.target === name) inflow += l.value;
    if (l.source === name) outflow += l.value;
  }
  return Math.max(inflow, outflow);
}

// Shortest-path-from-"Start" column assignment. Links almost always form a
// DAG (applications progress forward through statuses), but a manual status
// change can point backward — BFS-by-shortest-path still terminates cleanly
// in that case, it just draws that one link curving right-to-left.
function computeLevels(links: StatusFlowLink[]): Map<string, number> {
  const allNodes = new Set<string>();
  const adjacency = new Map<string, string[]>();
  for (const l of links) {
    allNodes.add(l.source);
    allNodes.add(l.target);
    if (!adjacency.has(l.source)) adjacency.set(l.source, []);
    adjacency.get(l.source)!.push(l.target);
  }

  const levels = new Map<string, number>([["Start", 0]]);
  const queue: string[] = ["Start"];
  while (queue.length) {
    const node = queue.shift()!;
    const level = levels.get(node)!;
    for (const next of adjacency.get(node) ?? []) {
      if (!levels.has(next)) {
        levels.set(next, level + 1);
        queue.push(next);
      }
    }
  }

  let maxLevel = 0;
  for (const lvl of levels.values()) maxLevel = Math.max(maxLevel, lvl);
  for (const n of allNodes) {
    if (!levels.has(n)) levels.set(n, maxLevel + 1);
  }
  return levels;
}

const NODE_THICKNESS = 16;
const COLUMN_SPACING = 180;
const SIDE_PAD = 76;
const NODE_GAP = 18;
const PLOT_HEIGHT = 380;
const MARGIN_TOP = 28;
const MARGIN_BOTTOM = 12;

export default function ApplicationStatusSankey({ links }: { links: StatusFlowLink[] }) {
  if (links.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
        No status history yet — this fills in as applications move through statuses.
      </div>
    );
  }

  const levels = computeLevels(links);
  const numColumns = Math.max(...levels.values()) + 1;
  const columns: string[][] = Array.from({ length: numColumns }, () => []);
  for (const [name, level] of levels) columns[level].push(name);
  for (const col of columns) col.sort(compareNodes);

  const values = new Map(
    [...levels.keys()].map((name) => [name, nodeValue(name, links)])
  );
  const columnTotals = columns.map((col) => col.reduce((sum, n) => sum + values.get(n)!, 0));
  // Scale is bounded per-column, not just by the column with the largest total
  // value — a column with several nodes spends part of its height on the
  // fixed gaps between them, so it can need a smaller scale than a column
  // with one big node and the same total value.
  let scale = PLOT_HEIGHT / Math.max(...columnTotals, 1);
  columns.forEach((col, i) => {
    if (columnTotals[i] <= 0) return;
    const available = PLOT_HEIGHT - (col.length - 1) * NODE_GAP;
    scale = Math.min(scale, available / columnTotals[i]);
  });
  scale = Math.max(scale, 0.01);

  type NodePos = { x: number; y0: number; y1: number };
  const nodePos = new Map<string, NodePos>();
  columns.forEach((col, i) => {
    const x = SIDE_PAD + i * COLUMN_SPACING;
    const heights = col.map((n) => Math.max(values.get(n)! * scale, 3));
    const totalHeight = heights.reduce((a, b) => a + b, 0) + (col.length - 1) * NODE_GAP;
    let y = MARGIN_TOP + (PLOT_HEIGHT - totalHeight) / 2;
    col.forEach((name, j) => {
      const h = heights[j];
      nodePos.set(name, { x, y0: y, y1: y + h });
      y += h + NODE_GAP;
    });
  });

  const outgoingByNode = new Map<string, StatusFlowLink[]>();
  const incomingByNode = new Map<string, StatusFlowLink[]>();
  for (const l of links) {
    if (!outgoingByNode.has(l.source)) outgoingByNode.set(l.source, []);
    outgoingByNode.get(l.source)!.push(l);
    if (!incomingByNode.has(l.target)) incomingByNode.set(l.target, []);
    incomingByNode.get(l.target)!.push(l);
  }

  const outOffset = new Map<string, number>();
  for (const [node, list] of outgoingByNode) {
    let cursor = nodePos.get(node)!.y0;
    for (const l of [...list].sort((a, b) => compareNodes(a.target, b.target))) {
      outOffset.set(`${l.source}\u0000${l.target}`, cursor);
      cursor += Math.max(l.value * scale, 1);
    }
  }
  const inOffset = new Map<string, number>();
  for (const [node, list] of incomingByNode) {
    let cursor = nodePos.get(node)!.y0;
    for (const l of [...list].sort((a, b) => compareNodes(a.source, b.source))) {
      inOffset.set(`${l.source}\u0000${l.target}`, cursor);
      cursor += Math.max(l.value * scale, 1);
    }
  }

  const totalWidth = SIDE_PAD * 2 + (numColumns - 1) * COLUMN_SPACING + NODE_THICKNESS;
  const totalHeight = MARGIN_TOP + PLOT_HEIGHT + MARGIN_BOTTOM;

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          width={totalWidth}
          height={totalHeight}
          className="min-w-full"
          role="img"
          aria-label="Flow of applications between statuses"
        >
          {links.map((l) => {
            const key = `${l.source}\u0000${l.target}`;
            const source = nodePos.get(l.source)!;
            const target = nodePos.get(l.target)!;
            const thickness = Math.max(l.value * scale, 1);
            const x0 = source.x + NODE_THICKNESS;
            const y0top = outOffset.get(key)!;
            const y0bot = y0top + thickness;
            const x1 = target.x;
            const y1top = inOffset.get(key)!;
            const y1bot = y1top + thickness;
            const xi = (x0 + x1) / 2;
            const path = `M${x0},${y0top} C${xi},${y0top} ${xi},${y1top} ${x1},${y1top} L${x1},${y1bot} C${xi},${y1bot} ${xi},${y0bot} ${x0},${y0bot} Z`;
            return (
              <path
                key={key}
                d={path}
                className={cn(STATUS_FILL[l.target] ?? DEFAULT_FILL, "opacity-25")}
              >
                <title>
                  {l.source} → {l.target}: {l.value}
                </title>
              </path>
            );
          })}

          {[...nodePos.entries()].map(([name, pos]) => (
            <g key={name}>
              <rect
                x={pos.x}
                y={pos.y0}
                width={NODE_THICKNESS}
                height={pos.y1 - pos.y0}
                rx={3}
                className={STATUS_FILL[name] ?? DEFAULT_FILL}
              >
                <title>
                  {name === "Start" ? "New application" : name}: {values.get(name)}
                </title>
              </rect>
              <text
                x={pos.x + NODE_THICKNESS / 2}
                y={pos.y0 - 8}
                textAnchor="middle"
                className="fill-foreground text-[11px]"
              >
                {name === "Start" ? "New" : name} · {values.get(name)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Flow of applications between statuses, based on logged status changes. Hover a band or
        node for its exact count.
      </p>
    </div>
  );
}
