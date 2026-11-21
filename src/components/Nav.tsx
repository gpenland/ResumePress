import Link from "next/link";
import { Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import SubmitButton from "@/components/SubmitButton";
import { auth, signIn, signOut } from "@/lib/auth";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";
import NavLinks from "@/components/NavLinks";
import { listTriageThreadsForUser } from "@/lib/emailThreads";
import { gmailNeedsReauth } from "@/lib/gmailAccount";
import { cn } from "@/lib/utils";

export default async function Nav() {
  const session = await auth();
  const triageCount = session?.user?.id
    ? (await listTriageThreadsForUser(session.user.id)).length
    : 0;

  const emailNeedsReauth = session?.user?.id ? await gmailNeedsReauth(session.user.id) : false;

  const navLinks = [
    { href: "/applications", label: "Applications" },
    { href: "/contacts", label: "Contacts" },
    { href: "/resumes", label: "Resumes", matchPrefixes: ["/entries", "/categories"] },
    { href: "/email", label: "Email", badge: triageCount, alert: emailNeedsReauth },
  ];

  // On lg the header shares the page's four-column grid: wordmark in the
  // first column, links starting at the second, actions ending at the last —
  // each 24px inside its column like everything below it.
  return (
    <header className="bg-background sticky top-0 z-50 border-b border-dashed border-grid">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-4 min-w-0 lg:grid lg:grid-cols-4">
        <Link href="/" className="font-heading text-2xl tracking-tight text-foreground shrink-0 lg:px-6">
          ResumePress
        </Link>
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 justify-end lg:contents">
          <div className="min-w-0 lg:col-span-2 lg:px-6">
            <NavLinks links={navLinks} />
          </div>
          <div className="flex items-center justify-end gap-2 min-w-0 lg:px-6">
            {session?.user && (
              <Link
                href="/search"
                aria-label="Search"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-muted-foreground gap-2 max-lg:size-8 max-lg:px-0")}
              >
                <Search className="size-4" />
                <span className="hidden lg:inline">Search</span>
              </Link>
            )}
            <ThemeToggle />
            {session?.user ? (
              <UserMenu
                user={session.user}
                signOutAction={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              />
            ) : (
              <form
                action={async () => {
                  "use server";
                  await signIn("google");
                }}
              >
                <SubmitButton size="sm" variant="outline" pendingText="Signing in…">
                  Sign in
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
