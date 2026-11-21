"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { APPLICATION_STATUSES, statusFillClass } from "@/lib/applicationsShared";
import type { StatusFlowLink } from "@/lib/applications";

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
// Columns spread across whatever width the panel has (measured below), but
// never closer than this — below it the chart scrolls sideways instead.
const MIN_COLUMN_SPACING = 160;
// Room for the first column's labels (drawn to the left of its nodes) and
// the last column's (drawn to the right), so neither collides with a band.
const LEFT_PAD = 96;
const RIGHT_PAD = 120;
// Middle-column labels sit above their node, so stacked nodes need enough
// gap between them to fit one.
const NODE_GAP = 30;
const PLOT_HEIGHT = 380;
const MARGIN_TOP = 28;
const MARGIN_BOTTOM = 12;

type Tooltip = { x: number; y: number; label: string; value: number };

export default function ApplicationStatusSankey({ links }: { links: StatusFlowLink[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [availableWidth, setAvailableWidth] = useState(900);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Native SVG <title> tooltips are unreliable across browsers (slow/absent
  // delay, no keyboard-focus equivalent), so hover/focus is driven here
  // instead and positioned against the outer (unscrolled) wrapper so it
  // isn't clipped by the inner horizontal scroller.
  function showAtPointer(e: React.PointerEvent, label: string, value: number) {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setTooltip({ x: e.clientX - bounds.left, y: e.clientY - bounds.top, label, value });
  }

  function showAtElement(e: React.FocusEvent<SVGElement>, label: string, value: number) {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const target = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: target.left + target.width / 2 - bounds.left,
      y: target.top - bounds.top,
      label,
      value,
    });
  }

  function hideTooltip() {
    setTooltip(null);
  }

  if (links.length === 0) {
    return (
      <div className="border bg-card p-10 text-center text-sm text-muted-foreground">
        No status history yet. It fills in as applications change status.
      </div>
    );
  }

  const levels = computeLevels(links);
  const numColumns = Math.max(...levels.values()) + 1;
  const columnSpacing =
    numColumns > 1
      ? Math.max(MIN_COLUMN_SPACING, (availableWidth - LEFT_PAD - RIGHT_PAD - NODE_THICKNESS) / (numColumns - 1))
      : 0;
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
    const x = LEFT_PAD + i * columnSpacing;
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

  const totalWidth = LEFT_PAD + RIGHT_PAD + (numColumns - 1) * columnSpacing + NODE_THICKNESS;
  const totalHeight = MARGIN_TOP + PLOT_HEIGHT + MARGIN_BOTTOM;

  return (
    <div className="border bg-card px-4 py-6 lg:px-6">
      <div ref={containerRef} className="relative">
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
              const label = `${l.source === "Start" ? "New" : l.source} → ${l.target}`;
              return (
                <path
                  key={key}
                  d={path}
                  tabIndex={0}
                  role="button"
                  aria-label={`${label}: ${l.value}`}
                  className={cn(
                    statusFillClass(l.target),
                    "opacity-25 outline-none transition-opacity hover:opacity-50 focus-visible:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  )}
                  onPointerEnter={(e) => showAtPointer(e, label, l.value)}
                  onPointerMove={(e) => showAtPointer(e, label, l.value)}
                  onPointerLeave={hideTooltip}
                  onFocus={(e) => showAtElement(e, label, l.value)}
                  onBlur={hideTooltip}
                />
              );
            })}

            {[...nodePos.entries()].map(([name, pos]) => {
              const label = name === "Start" ? "New application" : name;
              const value = values.get(name)!;
              return (
                <g key={name}>
                  <rect
                    x={pos.x}
                    y={pos.y0}
                    width={NODE_THICKNESS}
                    height={pos.y1 - pos.y0}
                    rx={3}
                    tabIndex={0}
                    role="button"
                    aria-label={`${label}: ${value}`}
                    className={cn(
                      statusFillClass(name),
                      "outline-none transition-opacity hover:opacity-70 focus-visible:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    )}
                    onPointerEnter={(e) => showAtPointer(e, label, value)}
                    onPointerMove={(e) => showAtPointer(e, label, value)}
                    onPointerLeave={hideTooltip}
                    onFocus={(e) => showAtElement(e, label, value)}
                    onBlur={hideTooltip}
                  />
                  <text {...labelPosition(levels.get(name)!, numColumns, pos)} className="fill-foreground text-[11px]">
                    {name === "Start" ? "New" : name} · {value}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <span className="font-medium">{tooltip.value}</span>{" "}
            <span className="text-muted-foreground">{tooltip.label}</span>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        How applications have moved between statuses, from logged status changes. Each number
        counts applications that ever reached that status, so it can be higher than the
        dashboard&apos;s count of applications currently in it. Hover a band or node for its
        exact count.
      </p>
    </div>
  );
}

// First column: label to the left of the node; last column: to the right
// (nothing flows out of it); middle columns: centred above the node, where
// the bands entering and leaving it can't run through the text.
function labelPosition(
  level: number,
  numColumns: number,
  pos: { x: number; y0: number; y1: number }
): { x: number; y: number; textAnchor: "start" | "middle" | "end"; dominantBaseline?: "middle" } {
  const midY = (pos.y0 + pos.y1) / 2;
  if (level === 0 && numColumns > 1) return { x: pos.x - 8, y: midY, textAnchor: "end", dominantBaseline: "middle" };
  if (level === numColumns - 1) return { x: pos.x + NODE_THICKNESS + 8, y: midY, textAnchor: "start", dominantBaseline: "middle" };
  return { x: pos.x + NODE_THICKNESS / 2, y: pos.y0 - 8, textAnchor: "middle" };
}
