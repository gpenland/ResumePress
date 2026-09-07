import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export default function Nav() {
  return (
    <header className="bg-background sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4 min-w-0">
        <Link href="/" className="font-semibold tracking-tight text-foreground shrink-0">
          ResumePress
        </Link>
        <nav className="flex items-center gap-3 sm:gap-6 text-sm text-muted-foreground overflow-x-auto min-w-0">
          <Link href="/entries" className="hover:text-foreground transition-colors shrink-0">
            Entries
          </Link>
          <Link href="/resumes" className="hover:text-foreground transition-colors shrink-0">
            Resumes
          </Link>
          <Link href="/categories" className="hover:text-foreground transition-colors shrink-0">
            Categories
          </Link>
        </nav>
      </div>
      <Separator />
    </header>
  );
}
