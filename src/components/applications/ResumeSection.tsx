import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Extension point for Module D (Resume integration, docs/MIGRATION_PLAN.md §5).
// Module D replaces this with its own <ResumePicker>/"Open resume"/"Recompile"
// component instead of editing applications/[id]/page.tsx directly — see the
// "coordination risk" note in MIGRATION_PLAN.md §5. Do not add contact/
// interaction UI here; that's Module B's own section, added independently.
export default function ResumeSection({
  applicationId,
  resumeId,
}: {
  applicationId: string;
  resumeId: string | null;
}) {
  return (
    <div className="rounded-lg border border-dashed p-4 space-y-2">
      <p className="text-sm font-medium">Resume</p>
      {resumeId ? (
        <Link href={`/resumes/${resumeId}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Open Resume
        </Link>
      ) : (
        <p className="text-sm text-muted-foreground">No resume linked yet.</p>
      )}
    </div>
  );
}
