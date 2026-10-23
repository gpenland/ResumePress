// Thin, dependency-free Gmail REST API client (plain fetch, no `googleapis`
// package — matches the OAuth skeleton's own style, see
// src/app/api/gmail/oauth/callback/route.ts). Every call here is read-only
// per PLAN.md §4 ("Gmail is read-only... request only gmail.readonly").

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

async function gmailFetch(path: string, accessToken: string): Promise<unknown> {
  const res = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GmailApiError(`Gmail API ${path} failed: ${res.status} ${body}`, res.status);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) {
    throw new GmailApiError("Google OAuth client not configured");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new GmailApiError(
      data.error_description ?? data.error ?? "Failed to refresh Gmail access token — reconnect Gmail.",
      res.status
    );
  }
  return data.access_token;
}

export type GmailLabel = { id: string; name: string; type: string };

export async function listLabels(accessToken: string): Promise<GmailLabel[]> {
  const data = (await gmailFetch("/labels", accessToken)) as { labels?: GmailLabel[] };
  return data.labels ?? [];
}

export async function getProfile(accessToken: string): Promise<{ historyId: string }> {
  const data = (await gmailFetch("/profile", accessToken)) as { historyId: string };
  return data;
}

export async function listMessageIdsForLabel(
  accessToken: string,
  labelId: string,
  maxResults = 50
): Promise<string[]> {
  const data = (await gmailFetch(
    `/messages?labelIds=${encodeURIComponent(labelId)}&maxResults=${maxResults}`,
    accessToken
  )) as { messages?: { id: string; threadId: string }[] };
  return [...new Set((data.messages ?? []).map((m) => m.threadId))];
}

/** New thread ids added to `labelId` since `startHistoryId`. Throws (caller should fall back to a full list) if the history window has expired. */
export async function listNewThreadIdsSinceHistory(
  accessToken: string,
  startHistoryId: string,
  labelId: string
): Promise<string[]> {
  const data = (await gmailFetch(
    `/history?startHistoryId=${encodeURIComponent(startHistoryId)}&labelId=${encodeURIComponent(labelId)}&historyTypes=messageAdded`,
    accessToken
  )) as { history?: { messagesAdded?: { message: { id: string; threadId: string } }[] }[] };
  const threadIds = (data.history ?? []).flatMap((h) => (h.messagesAdded ?? []).map((m) => m.message.threadId));
  return [...new Set(threadIds)];
}

export type GmailThread = {
  id: string;
  subject: string | null;
  snippet: string | null;
  participants: string[];
  lastMessageAt: Date;
};

function extractEmails(headerValue: string | undefined): string[] {
  if (!headerValue) return [];
  const matches = headerValue.match(/[^\s<>"',]+@[^\s<>"',]+/g) ?? [];
  return matches.map((e) => e.toLowerCase());
}

export async function getThread(accessToken: string, threadId: string): Promise<GmailThread> {
  const data = (await gmailFetch(
    `/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject`,
    accessToken
  )) as {
    id: string;
    messages: {
      snippet?: string;
      internalDate?: string;
      payload?: { headers?: { name: string; value: string }[] };
    }[];
  };

  const participants = new Set<string>();
  let subject: string | null = null;
  let lastInternalDate = 0;
  let snippet: string | null = null;

  for (const message of data.messages ?? []) {
    const headers = message.payload?.headers ?? [];
    for (const h of headers) {
      if (["From", "To", "Cc"].includes(h.name)) {
        for (const email of extractEmails(h.value)) participants.add(email);
      }
      if (h.name === "Subject" && !subject) subject = h.value;
    }
    const internalDate = Number(message.internalDate ?? 0);
    if (internalDate >= lastInternalDate) {
      lastInternalDate = internalDate;
      snippet = message.snippet ?? snippet;
    }
  }

  return {
    id: data.id,
    subject,
    snippet,
    participants: [...participants],
    lastMessageAt: lastInternalDate ? new Date(lastInternalDate) : new Date(),
  };
}

export function gmailThreadUrl(threadId: string): string {
  return `https://mail.google.com/mail/u/0/#all/${threadId}`;
}
