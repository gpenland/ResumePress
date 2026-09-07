import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";

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
        <Button type="submit" size="lg" className="w-full">
          Sign in with Google
        </Button>
      </form>
    </div>
  );
}
