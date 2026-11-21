import Link from "next/link";

// A small printer's note, the way a real document might carry one at the
// bottom of its last page — ties back to the "paper" design language.
// Rotates by day-of-year (not randomly) so it's stable within a day and
// needs no client state. Purely decorative. Moved here from the dashboard so
// every page ends the same way.
const COLOPHON_LINES = [
  "Typeset with care.",
  "You miss every shot you don't take.",
  "You are not great than your resume.",
  "No LaTeX was harmed in the making of this dashboard.",
  "We are all GMI",
  "Powered by AI slop.",
  "Loading AI B2B SaaS...",
];

function colophonLine(): string {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000);
  return COLOPHON_LINES[dayOfYear % COLOPHON_LINES.length];
}

export default function SiteFooter() {
  return (
    <footer className="border-t border-dashed border-grid">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-3 px-4 py-6 text-center text-xs text-muted-foreground sm:grid-cols-3 sm:text-left">
        <p className="lg:px-6">© {new Date().getFullYear()} ResumePress</p>
        <p className="font-heading text-base sm:text-center">{colophonLine()}</p>
        <nav className="flex justify-center gap-5 sm:justify-end lg:px-6">
          <Link href="/applications/import" className="hover:text-foreground transition-colors">Import</Link>
          <Link href="/search" className="hover:text-foreground transition-colors">Search</Link>
          <Link href="/settings/tokens" className="hover:text-foreground transition-colors">API tokens</Link>
        </nav>
      </div>
    </footer>
  );
}
