import Link from "next/link";
import { Search } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button";
import SubmitButton from "@/components/SubmitButton";
import { auth, signIn, signOut } from "@/lib/auth";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";
import NavLinks from "@/components/NavLinks";
import { listTriageThreadsForUser } from "@/lib/emailThreads";
import { cn } from "@/lib/utils";

export default async function Nav() {
  const session = await auth();
  const triageCount = session?.user?.id
    ? (await listTriageThreadsForUser(session.user.id)).length
    : 0;

  const navLinks = [
    { href: "/applications", label: "Applications" },
    { href: "/contacts", label: "Contacts" },
    { href: "/resumes", label: "Resumes", matchPrefixes: ["/entries", "/categories"] },
    { href: "/email", label: "Email", badge: triageCount },
  ];

  return (
    <header className="bg-background sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4 min-w-0">
        <Link href="/" className="font-heading font-semibold tracking-tight text-foreground shrink-0">
          ResumePress
        </Link>
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <NavLinks links={navLinks} />
          {session?.user && (
            <Link
              href="/search"
              aria-label="Search"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-muted-foreground")}
            >
              <Search className="size-4" />
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
      <Separator />
    </header>
  );
}
