"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NavLink = {
  href: string;
  label: string;
  /** Extra path prefixes (besides `href`) that should also count as "active" for this link. */
  matchPrefixes?: string[];
  /** Optional count badge, e.g. pending email triage items. */
  badge?: number;
};

function isLinkActive(pathname: string, link: NavLink): boolean {
  const prefixes = [link.href, ...(link.matchPrefixes ?? [])];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Below `md`, four text links plus badges don't fit the header without
// relying on horizontal scroll (a poor mobile pattern for primary nav), so
// they collapse into this menu instead. Above `md`, the plain inline list
// renders and this never mounts its trigger.
function MobileNavMenu({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  const activeCount = links.reduce((sum, l) => sum + (l.badge ?? 0), 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Open navigation menu" className="relative md:hidden text-muted-foreground">
            <Menu className="size-4" />
            {activeCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary" />
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="start">
        {links.map((link) => (
          <DropdownMenuItem key={link.href} render={<Link href={link.href} />}>
            <span className={cn(isLinkActive(pathname, link) && "font-medium text-foreground")}>
              {link.label}
            </span>
            {!!link.badge && <Badge variant="secondary">{link.badge}</Badge>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function NavLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <>
      <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
        {links.map((link) => {
          const isActive = isLinkActive(pathname, link);
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
      <MobileNavMenu links={links} />
    </>
  );
}
