"use client";

import { usePathname } from "next/navigation";
import SegmentedLinks from "@/components/SegmentedLinks";

// Resumes / Entries switch, shown in both pages' header actions — the same
// control the applications page uses for List / Kanban / Flow.
export default function ResumeSectionTabs() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <SegmentedLinks
      label="Resume builder"
      items={[
        { label: "Resumes", href: "/resumes", active: isActive("/resumes") },
        { label: "Entries", href: "/entries", active: isActive("/entries") },
      ]}
    />
  );
}
