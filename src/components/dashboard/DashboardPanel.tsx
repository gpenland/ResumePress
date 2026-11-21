import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { GRID_INSET } from "@/components/PageGrid";
import { cn } from "@/lib/utils";

// Dashboard list panel. Rows are separated by spacing and a hover fill
// rather than rules, keeping the page to two line styles: the dashed grid
// and solid surface borders.
export function Panel({
  title,
  badge,
  action,
  children,
}: {
  title: string;
  badge?: number;
  action: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <section className="border bg-card">
      <div className={cn("flex items-center justify-between gap-3 pt-4 pb-2", GRID_INSET)}>
        <h2 className="flex items-center gap-2 text-2xl font-heading">
          {title}
          {badge !== undefined && <Badge variant="secondary" className="font-sans not-italic">{badge}</Badge>}
        </h2>
        <Link href={action.href} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-mr-2.5 text-muted-foreground")}>
          {action.label} →
        </Link>
      </div>
      <div className="pb-2">{children}</div>
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
