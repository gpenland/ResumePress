"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavLink = {
  href: string;
  label: string;
};

export default function NavLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-3 sm:gap-6 text-sm text-muted-foreground overflow-x-auto min-w-0">
      {links.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "hover:text-foreground transition-colors shrink-0",
              isActive && "text-foreground font-medium"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
