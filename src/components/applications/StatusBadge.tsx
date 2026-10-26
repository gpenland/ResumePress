import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusBadgeClasses } from "@/lib/applicationsShared";

export default function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", statusBadgeClasses(status))}>
      {/* The status itself already calls it "Ghosted" — the emoji just winks at a word the app's own taxonomy picked. */}
      {status === "Ghosted" ? "👻 Ghosted" : status}
    </Badge>
  );
}
