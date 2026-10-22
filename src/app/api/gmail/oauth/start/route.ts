import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getOwnerUserId } from "@/lib/auth";

// Separate "Connect Gmail" flow, decoupled from NextAuth's own signIn()/Account
// — see docs/MIGRATION_PLAN.md §1.1 for why. Reuses the existing AUTH_GOOGLE_ID
// client; only a new authorized redirect URI needs to be added in Google Cloud
// (this route's own callback), no second OAuth client.
const GMAIL_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

const STATE_COOKIE = "gmail_oauth_state";

export async function GET(req: Request) {
  const userId = await getOwnerUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  if (!clientId) {
    return NextResponse.json({ error: "AUTH_GOOGLE_ID is not configured" }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/gmail/oauth/callback`;
  const state = randomBytes(16).toString("hex");

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GMAIL_SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/gmail/oauth",
  });
  return response;
}
