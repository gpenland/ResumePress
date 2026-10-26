"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/resumes", label: "Resumes" },
  { href: "/entries", label: "Entries" },
];

export default function ResumeSectionTabs() {
  const pathname = usePathname();

  return (
    <div className="border-b border-border">
      <nav className="flex gap-6 -mb-px">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "pb-3 text-sm border-b-2 transition-colors",
                isActive
                  ? "border-foreground text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
