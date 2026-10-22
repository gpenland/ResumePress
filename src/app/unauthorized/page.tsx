import { signOut } from "@/lib/auth";
import SubmitButton from "@/components/SubmitButton";

export default function UnauthorizedPage() {
  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold mb-2">Access restricted</h1>
      <p className="text-muted-foreground text-sm mb-6">
        This app is private to its owner. The Google account you&apos;re signed in with
        doesn&apos;t have access.
      </p>
      <form action={signOutAction}>
        <SubmitButton size="lg" className="w-full" pendingText="Signing out…">
          Sign out and try another account
        </SubmitButton>
      </form>
    </div>
  );
}
