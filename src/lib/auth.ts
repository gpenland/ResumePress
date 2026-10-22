import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: { strategy: "database" },
  pages: { signIn: "/login" },
  trustHost: true,
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});

/** For pages: never redirects, callers render logged-out state with no data. */
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** For server actions that mutate data: redirects to /login if no session. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user.id;
}

/**
 * Single-owner allowlist, app-wide (see docs/MIGRATION_PLAN.md §1.2). Enforced
 * by the (protected) route group's layout for pages, and must be checked
 * explicitly in any API route handler (route handlers don't run through page
 * layouts) — see GET /api/pdf/[resumeId] for the pattern. Does NOT apply to
 * the bearer-token MCP auth path (src/lib/apiToken.ts) — that's a separate,
 * per-token authorization boundary, untouched by this gate.
 */
export function isOwner(email: string | null | undefined): boolean {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) return false;
  return !!email && email.toLowerCase() === ownerEmail.toLowerCase();
}

/**
 * For API route handlers only (layouts already gate pages — see
 * (protected)/layout.tsx). Returns the owner's userId, or null if the
 * caller isn't the allowlisted owner (no session, or signed in as someone
 * else) — callers return a 401/404 themselves, matching this file's
 * existing never-throw style.
 */
export async function getOwnerUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || !isOwner(session.user.email)) return null;
  return session.user.id;
}
