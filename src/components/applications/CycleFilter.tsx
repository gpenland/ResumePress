"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cycleShortLabel, serializeCycleSearchParam } from "@/lib/recruitingCycleShared";

// Multi-select recruiting-cycle filter (GitHub issue #106), shared between
// the dashboard Statistics panel and the applications page. `selected` is
// undefined for "all cycles" (see parseCycleSearchParam). Drives the `cycle`
// search param directly rather than local state, so the filter is a normal
// shareable/bookmarkable URL like the rest of this page's filters (status,
// view) — no other params are touched.
export default function CycleFilter({
  options,
  selected,
}: {
  options: number[];
  selected: number[] | undefined;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setCycles(next: number[] | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("cycle", serializeCycleSearchParam(next));
    router.push(`${pathname}?${params.toString()}`);
  }

  const isAll = selected === undefined;
  const selectedSet = new Set(selected ?? []);

  function toggle(year: number) {
    if (isAll) {
      setCycles([year]);
      return;
    }
    const next = new Set(selectedSet);
    if (next.has(year)) next.delete(year);
    else next.add(year);
    setCycles(next.size === 0 ? undefined : Array.from(next));
  }

  const label = isAll
    ? "All cycles"
    : selected.length === 1
      ? cycleShortLabel(selected[0])
      : `${selected.length} cycles`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            {label}
            <ChevronDown className="size-3.5" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {/* DropdownMenuLabel wraps Base UI's Menu.GroupLabel, which requires a
            surrounding Menu.Group (its MenuGroupContext) — omitting this
            wrapper throws Base UI error #31 as soon as the menu opens. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Recruiting cycle</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={isAll} onCheckedChange={() => setCycles(undefined)}>
            All cycles
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {options.map((year) => (
            <DropdownMenuCheckboxItem key={year} checked={!isAll && selectedSet.has(year)} onCheckedChange={() => toggle(year)}>
              {cycleShortLabel(year)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
