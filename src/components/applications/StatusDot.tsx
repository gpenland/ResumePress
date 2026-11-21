import { cn } from "@/lib/utils";
import { statusDotClass } from "@/lib/applicationsShared";

export default function StatusDot({ status, className }: { status: string; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-[7px] shrink-0 rounded-full", statusDotClass(status), className)} />;
}
