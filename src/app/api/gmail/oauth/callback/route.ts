import { NextResponse } from "next/server";
import { getAllowedUserId, getAppOrigin } from "@/lib/auth";
import { saveGmailAccount } from "@/lib/gmailAccount";

const STATE_COOKIE = "gmail_oauth_state";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

/** Display-only: Google's token endpoint response, not a verified assertion used for auth decisions. */
function decodeEmailFromIdToken(idToken: string): string | null {
  try {
    const payload = idToken.split(".")[1];
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    return typeof json.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const userId = await getAllowedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.headers
    .get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith(`${STATE_COOKIE}=`))
    ?.split("=")[1];

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.json({ error: "Invalid or expired OAuth state" }, { status: 400 });
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Google OAuth client not configured" }, { status: 500 });
  }

  const origin = getAppOrigin(req);
  const redirectUri = `${origin}/api/gmail/oauth/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokens: TokenResponse = await tokenRes.json();

  if (!tokenRes.ok || !tokens.refresh_token) {
    // No refresh_token usually means Google didn't show the consent screen (already
    // granted previously without access_type=offline sticking) — the user needs to
    // revoke access at myaccount.google.com/permissions and reconnect.
    return NextResponse.json(
      {
        error: "Gmail connection failed",
        detail: tokens.error_description ?? tokens.error ?? "No refresh token returned",
      },
      { status: 400 }
    );
  }

  const email = tokens.id_token ? decodeEmailFromIdToken(tokens.id_token) : null;

  await saveGmailAccount(userId, {
    email: email ?? "unknown",
    refreshToken: tokens.refresh_token,
    scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
  });

  const response = NextResponse.redirect(new URL("/email", origin));
  response.cookies.delete(STATE_COOKIE);
  return response;
}
