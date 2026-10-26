"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, Check, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ContactOption = { id: string; name: string };
type CreateContact = (name: string, email: string | null) => Promise<{ id: string; name: string }>;

type Props = {
  options: ContactOption[];
  value: string;
  onChange: (id: string) => void;
  participants: string[];
  createContact: CreateContact;
};

const PANEL_WIDTH = 280;

/**
 * Searchable replacement for a plain <select> of every contact — matches
 * ApplicationPicker's interaction model for consistency between the two
 * triage pickers. Also owns "+ New contact" (an inline create dialog),
 * folded in here instead of a separate always-visible row button, so the
 * triage row's action row has one fewer element to wrap.
 */
export default function ContactPicker({ options, value, onChange, participants, createContact }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [panelRect, setPanelRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);
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
    const maxIndex = filtered.length + 1; // 0 is "No contact", 1..n are options, last is "+ New contact"
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, maxIndex));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight === 0) choose("");
      else if (highlight === maxIndex) {
        setOpen(false);
        setNewContactOpen(true);
      } else {
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
        className="h-8 min-w-[9rem] max-w-[16rem] flex items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm"
      >
        <span className="truncate">{selected ? selected.name : "No contact"}</span>
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
              placeholder="Search contacts..."
              aria-label="Search contacts"
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
                No contact
              </button>
            </li>

            {filtered.length === 0 && (
              <li className="px-2.5 py-3 text-xs text-muted-foreground text-center">No matches</li>
            )}

            {filtered.map((opt, i) => (
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
                  <span className="truncate flex-1">{opt.name}</span>
                </button>
              </li>
            ))}

            <li data-index={filtered.length + 1} className="border-t mt-1 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setNewContactOpen(true);
                }}
                onMouseEnter={() => setHighlight(filtered.length + 1)}
                className={cn(
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-sm text-left text-primary hover:bg-muted",
                  highlight === filtered.length + 1 && "bg-muted"
                )}
              >
                <Plus className="size-3.5 shrink-0" />
                New contact
              </button>
            </li>
          </ul>
        </div>,
        document.body
      )}

      <NewContactDialog
        open={newContactOpen}
        onOpenChange={setNewContactOpen}
        participants={participants}
        createContact={createContact}
        onCreated={(contact) => {
          onChange(contact.id);
          router.refresh();
        }}
      />
    </div>
  );
}

function NewContactDialog({
  open,
  onOpenChange,
  participants,
  createContact,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: string[];
  createContact: CreateContact;
  onCreated: (contact: { id: string; name: string }) => void;
}) {
  const [email, setEmail] = useState(participants[0] ?? "");
  const [isPending, setIsPending] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = nameRef.current?.value.trim();
    if (!name) return;
    setIsPending(true);
    const contact = await createContact(name, email || null);
    setIsPending(false);
    onCreated(contact);
    onOpenChange(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>New contact</AlertDialogTitle>
        </AlertDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            ref={nameRef}
            name="name"
            placeholder="Name"
            required
            autoFocus
            autoComplete="off"
            data-1p-ignore
          />
          {participants.length > 1 ? (
            <select
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email"
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {participants.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-muted-foreground px-0.5">{email || "No email found on this thread"}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
