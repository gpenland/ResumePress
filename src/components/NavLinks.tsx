"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavLink = {
  href: string;
  label: string;
};

type NavGroup = {
  label: string;
  links: NavLink[];
};

type NavItem = NavLink | NavGroup;

function isGroup(item: NavItem): item is NavGroup {
  return "links" in item;
}

export default function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  const isLinkActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex items-center gap-3 sm:gap-6 text-sm text-muted-foreground overflow-x-auto min-w-0">
      {items.map((item) => {
        if (isGroup(item)) {
          const active = item.links.some((link) => isLinkActive(link.href));
          return (
            <DropdownMenu key={item.label}>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1 hover:text-foreground transition-colors shrink-0 outline-none",
                      active && "text-foreground font-medium"
                    )}
                  >
                    {item.label}
                    <ChevronDown className="size-3.5" />
                  </button>
                }
              />
              <DropdownMenuContent align="start">
                {item.links.map((link) => (
                  <DropdownMenuItem key={link.href} render={<Link href={link.href} />}>
                    {link.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }

        const active = isLinkActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "hover:text-foreground transition-colors shrink-0",
              active && "text-foreground font-medium"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
