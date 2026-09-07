"use client";

import { useRef } from "react";

type Props = {
  value: string;
  onChange: (val: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
};

export default function RichTextArea({ value, onChange, rows = 2, placeholder, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function applyMarker(marker: string) {
    const el = ref.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const before = value.slice(0, start);
    const after = value.slice(end);

    let newValue: string;
    let cursorStart: number;
    let cursorEnd: number;

    if (selected) {
      newValue = before + marker + selected + marker + after;
      cursorStart = start + marker.length;
      cursorEnd = end + marker.length;
    } else {
      newValue = before + marker + marker + after;
      cursorStart = cursorEnd = start + marker.length;
    }

    onChange(newValue);

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  return (
    <div className="space-y-1 flex-1 min-w-0">
      <div className="flex gap-1">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); applyMarker("**"); }}
          className="h-6 w-6 rounded border border-input bg-background text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center justify-center"
          aria-label="Bold"
          title="Bold (**text**)"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); applyMarker("*"); }}
          className="h-6 w-6 rounded border border-input bg-background text-xs italic text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center justify-center"
          aria-label="Italic"
          title="Italic (*text*)"
        >
          I
        </button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={`flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y ${className ?? ""}`}
      />
    </div>
  );
}
