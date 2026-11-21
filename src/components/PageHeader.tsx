import { cn } from "@/lib/utils";

// Compact page header for PageGrid pages. The title block and the actions
// each sit on an opaque, full-height label box so the grid lines stop at
// their edges rather than running through the text.
export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-stretch justify-between gap-x-6">
      <div className="min-w-0 bg-background pt-8 pb-6 lg:px-6">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="mt-1 text-3xl tracking-tight font-heading">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-end gap-2 bg-background pb-6 lg:px-6 lg:pt-8">
          {actions}
        </div>
      )}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground", className)}>
      {children}
    </p>
  );
}
