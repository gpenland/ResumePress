"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type NavLink = {
  href: string;
  label: string;
  /** Extra path prefixes (besides `href`) that should also count as "active" for this link. */
  matchPrefixes?: string[];
  /** Optional count badge, e.g. pending email triage items. */
  badge?: number;
};

export default function NavLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-3 sm:gap-6 text-sm text-muted-foreground overflow-x-auto min-w-0">
      {links.map((link) => {
        const prefixes = [link.href, ...(link.matchPrefixes ?? [])];
        const isActive = prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "hover:text-foreground transition-colors shrink-0 inline-flex items-center gap-1.5",
              isActive && "text-foreground font-medium"
            )}
          >
            {link.label}
            {!!link.badge && <Badge variant="secondary">{link.badge}</Badge>}
          </Link>
        );
      })}
    </nav>
  );
}
