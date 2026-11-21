import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Href = ComponentProps<typeof Link>["href"];

// A row of mutually exclusive view links (List / Kanban / Flow, Resumes /
// Entries) drawn as one control. Sized to the default button height (h-8)
// so it lines up with the buttons and dropdowns beside it in a page header.
export default function SegmentedLinks({
  items,
  label,
  className,
}: {
  items: { label: string; href: Href; active: boolean }[];
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("inline-flex h-8 items-stretch border bg-card p-0.5", className)}>
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "flex items-center px-3 text-sm transition-colors",
            item.active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
