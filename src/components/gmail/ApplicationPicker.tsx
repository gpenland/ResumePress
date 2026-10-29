"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  rankApplicationOptions,
  matchesApplicationSearch,
  applicationOptionLabel,
  isDomainMatch,
  type ApplicationPickerOption,
} from "@/lib/emailThreadsShared";

type Props = {
  options: ApplicationPickerOption[];
  participants: string[];
  value: string;
  onChange: (id: string) => void;
};

const STALE_STATUSES = new Set(["Rejected", "Ghosted", "Withdrawn"]);
const PANEL_WIDTH = 320;

/**
 * Searchable, ranked replacement for a plain <select> of every application —
 * a flat alphabetical dropdown gets unusable once someone has dozens of
 * applications. Ranks company-domain matches to the thread's participants
 * first, deprioritizes stale (Rejected/Ghosted) statuses as a tie-breaker,
 * and lets typing narrow the rest instead of scrolling a huge list.
 */
export default function ApplicationPicker({ options, participants, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  // Position of the dropdown panel, computed from the trigger button's
  // viewport rect. The panel is rendered through a portal into document.body
  // (not inline here) because this picker lives inside a Card, and Card uses
  // overflow-hidden for its rounded corners — an inline absolutely-positioned
  // panel gets silently clipped at the card's edge instead of floating above
  // the page.
  const [panelRect, setPanelRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const ranked = useMemo(() => rankApplicationOptions(options, participants), [options, participants]);
  const filtered = useMemo(() => ranked.filter((o) => matchesApplicationSearch(o, query)), [ranked, query]);
  const selected = options.find((o) => o.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // The panel is `position: fixed` against the viewport, so it goes stale if
  // the page scrolls or resizes while open — close rather than let it drift
  // away from the trigger button.
  useEffect(() => {
    if (!open) return;
    function close() {
      setOpen(false);
    }
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setPanelRect({
        top: rect.bottom + 4,
        left: Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8),
        width: PANEL_WIDTH,
      });
    }
    setQuery("");
    setHighlight(0);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function choose(id: string) {
    onChange(id);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const maxIndex = filtered.length; // 0 is "No application", 1..n are filtered options
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, maxIndex));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight === 0) choose("");
      else {
        const opt = filtered[highlight - 1];
        if (opt) choose(opt.id);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="h-8 min-w-[11rem] max-w-[18rem] flex items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm"
      >
        <span className="truncate">{selected ? applicationOptionLabel(selected) : "No application"}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && panelRect && createPortal(
        <div
          ref={panelRef}
          style={{ position: "fixed", top: panelRect.top, left: panelRect.left, width: panelRect.width }}
          className="z-50 rounded-lg border bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          <div className="flex items-center gap-1.5 border-b px-2.5 py-1.5">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search applications..."
              aria-label="Search applications"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <ul ref={listRef} role="listbox" className="max-h-60 overflow-y-auto py-1">
            <li data-index={0}>
              <button
                type="button"
                role="option"
                aria-selected={value === ""}
                onClick={() => choose("")}
                onMouseEnter={() => setHighlight(0)}
                className={cn(
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-sm text-left hover:bg-muted",
                  highlight === 0 && "bg-muted"
                )}
              >
                <Check className={cn("size-3.5 shrink-0", value === "" ? "opacity-100" : "opacity-0")} />
                No application
              </button>
            </li>

            {filtered.length === 0 && (
              <li className="px-2.5 py-3 text-xs text-muted-foreground text-center">No matches</li>
            )}

            {filtered.map((opt, i) => {
              const suggested = !query && isDomainMatch(opt, participants);
              return (
                <li key={opt.id} data-index={i + 1}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === opt.id}
                    onClick={() => choose(opt.id)}
                    onMouseEnter={() => setHighlight(i + 1)}
                    className={cn(
                      "flex w-full items-center gap-2 px-2.5 py-1.5 text-sm text-left hover:bg-muted",
                      highlight === i + 1 && "bg-muted"
                    )}
                  >
                    <Check className={cn("size-3.5 shrink-0", value === opt.id ? "opacity-100" : "opacity-0")} />
                    <span className="truncate flex-1">{applicationOptionLabel(opt)}</span>
                    {suggested && (
                      <span className="text-xs text-primary shrink-0">Suggested</span>
                    )}
                    {!suggested && STALE_STATUSES.has(opt.status) && (
                      <span className="text-xs text-muted-foreground shrink-0">{opt.status}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}
