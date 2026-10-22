import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  Wishlist: "bg-muted text-muted-foreground",
  Preparing: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  Applied: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "OA/Screen": "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  Interviewing: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Offer: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Accepted: "bg-green-500/15 text-green-700 dark:text-green-400",
  Rejected: "bg-destructive/10 text-destructive",
  Withdrawn: "bg-muted text-muted-foreground",
  Ghosted: "bg-muted text-muted-foreground",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", STATUS_COLORS[status] ?? "bg-muted text-muted-foreground")}>
      {status}
    </Badge>
  );
}
