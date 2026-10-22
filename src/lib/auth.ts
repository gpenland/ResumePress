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
 * App-wide allowlist (see docs/MIGRATION_PLAN.md §1.2) — ALLOWED_EMAILS is a
 * comma-separated list, so more than one person can use this deployment,
 * each with their own fully isolated userId-scoped data (same ownership-check
 * pattern as everywhere else in this file). Enforced by the (protected)
 * route group's layout for pages, and must be checked explicitly in any API
 * route handler (route handlers don't run through page layouts) — see GET
 * /api/pdf/[resumeId] for the pattern. Does NOT apply to the bearer-token
 * MCP auth path (src/lib/apiToken.ts) — that's a separate, per-token
 * authorization boundary, untouched by this gate. Pairs with (doesn't
 * replace) restricting the Google Cloud OAuth consent screen's own Test
 * users list, which stops anyone not on it before they ever reach this app.
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

/**
 * For API route handlers only (layouts already gate pages — see
 * (protected)/layout.tsx). Returns the caller's userId, or null if their
 * email isn't on ALLOWED_EMAILS (no session, or signed in as someone not
 * allowed) — callers return a 401/404 themselves, matching this file's
 * existing never-throw style.
 */
export async function getAllowedUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || !isAllowedEmail(session.user.email)) return null;
  return session.user.id;
}

/**
 * Canonical public origin — the same source of truth `trustHost: true` lets
 * NextAuth use for its own callback URL. Behind Sevalla's reverse proxy, a
 * Route Handler's own `req.url` reflects the container's internal bind
 * address (0.0.0.0, per the Dockerfile), not the public domain, so anything
 * building its own redirect/callback URL (e.g. the Gmail OAuth routes) must
 * use this instead of `new URL(req.url).origin`. Falls back to the request
 * for local dev, where AUTH_URL typically isn't set.
 */
export function getAppOrigin(req: Request): string {
  return process.env.AUTH_URL?.replace(/\/$/, "") || new URL(req.url).origin;
}
