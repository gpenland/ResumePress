import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { GRID_INSET } from "@/components/PageGrid";
import { cn } from "@/lib/utils";

// The one content surface on gridded pages: an opaque bordered card (so the
// page grid's lines stop at its edge) with a serif heading. Every section on
// every page uses this, so sections look the same wherever they appear.
//
// `action` is always a "see all"-style link in the heading row; anything
// richer (buttons, filters) goes in `actions`. `padded` wraps the body in
// the shared text inset for free-form content; lists of PanelRows leave it
// off because each row carries its own inset (so its hover fill reaches the
// panel's edges).
export function Panel({
  id,
  title,
  badge,
  action,
  actions,
  padded = false,
  className,
  children,
}: {
  id?: string;
  title?: React.ReactNode;
  badge?: number;
  action?: { label: string; href: string };
  actions?: React.ReactNode;
  padded?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const hasHeading = title || action || actions;
  return (
    <section id={id} className={cn("scroll-mt-24 border bg-card", className)}>
      {hasHeading && (
        <div className={cn("flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-4 pb-2", GRID_INSET)}>
          {title && (
            <h2 className="flex items-center gap-2 text-2xl font-heading">
              {title}
              {badge !== undefined && <Badge variant="secondary" className="font-sans not-italic">{badge}</Badge>}
            </h2>
          )}
          {action && (
            <Link href={action.href} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-mr-2.5 text-muted-foreground")}>
              {action.label} →
            </Link>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(padded ? cn("pt-2 pb-5", GRID_INSET) : "pb-2", !hasHeading && (padded ? "pt-5" : "pt-2"))}>
        {children}
      </div>
    </section>
  );
}

export function PanelRow({
  href,
  title,
  subtitle,
  meta,
}: {
  href: string;
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn("flex items-center justify-between gap-4 py-2.5 transition-colors hover:bg-muted/50", GRID_INSET)}>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {meta && <div className="shrink-0">{meta}</div>}
    </Link>
  );
}

export function PanelEmpty({ message, action }: { message: string; action?: { label: string; href: string } }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 py-8 text-center", GRID_INSET)}>
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && (
        <Link href={action.href} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          {action.label}
        </Link>
      )}
    </div>
  );
}

/** Label/value pairs, for an object's facts (an application's term, a contact's emails). */
export function FactList({ facts }: { facts: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="space-y-3">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 text-sm font-medium break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
