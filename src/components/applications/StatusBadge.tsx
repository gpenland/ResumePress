import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusBadgeClasses } from "@/lib/applicationsShared";

export default function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", statusBadgeClasses(status))}>
      {status}
    </Badge>
  );
}
