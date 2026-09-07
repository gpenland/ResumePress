import { signIn } from "@/lib/auth";
import SubmitButton from "@/components/SubmitButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: callbackUrl || "/" });
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold mb-2">Sign in to ResumePress</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Sign in to see and manage your entries and resumes.
      </p>
      <form action={signInWithGoogle}>
        <SubmitButton size="lg" className="w-full" pendingText="Signing in…">
          Sign in with Google
        </SubmitButton>
      </form>
    </div>
  );
}
