import Link from "next/link";

export default function Nav() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <nav className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold text-zinc-900 tracking-tight">
          ResumePress
        </Link>
        <div className="flex items-center gap-6 text-sm text-zinc-600">
          <Link href="/entries" className="hover:text-zinc-900 transition-colors">
            Entries
          </Link>
          <Link href="/resumes" className="hover:text-zinc-900 transition-colors">
            Resumes
          </Link>
          <Link href="/categories" className="hover:text-zinc-900 transition-colors">
            Categories
          </Link>
        </div>
      </nav>
    </header>
  );
}
