import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// The one page header every page uses, inside PageGrid's masthead band. The
// title text sits at the shared 24px inset (lg:px-6) so it lines up with the
// logo in the nav and with text inside every gridded surface below.
//
// `back` turns the eyebrow into a link to the parent page — detail and form
// pages use it instead of a plain label, so there's always a way back up.
export default function PageHeader({
  eyebrow,
  back,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  back?: { href: string; label: string };
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-8 pb-6">
      <div className="min-w-0 lg:px-6">
        {back ? (
          <Link
            href={back.href}
            className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3" aria-hidden="true" />
            {back.label}
          </Link>
        ) : (
          eyebrow && <Eyebrow>{eyebrow}</Eyebrow>
        )}
        <h1 className="mt-1 text-3xl tracking-tight font-heading break-words">{title}</h1>
        {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto lg:px-6">{actions}</div>
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
