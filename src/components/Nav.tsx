import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export default function Nav() {
  return (
    <header className="bg-background sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight text-foreground">
          ResumePress
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/entries" className="hover:text-foreground transition-colors">
            Entries
          </Link>
          <Link href="/resumes" className="hover:text-foreground transition-colors">
            Resumes
          </Link>
          <Link href="/categories" className="hover:text-foreground transition-colors">
            Categories
          </Link>
        </nav>
      </div>
      <Separator />
    </header>
  );
}
