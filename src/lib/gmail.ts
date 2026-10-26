// Thin, dependency-free Gmail REST API client (plain fetch, no `googleapis`
// package — matches the OAuth skeleton's own style, see
// src/app/api/gmail/oauth/callback/route.ts). Every call here is read-only
// per PLAN.md §4 ("Gmail is read-only... request only gmail.readonly").

import { stripTags } from "@/lib/htmlText";

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

// Shared pagination core for both listInboxThreadIds and
// listThreadIdsForLabel below — walks nextPageToken (Gmail caps a single
// page at 500) until either results run out or `limit` unique thread ids
// have been collected.
async function paginatedThreadIds(
  accessToken: string,
  baseParams: Record<string, string>,
  limit: number
): Promise<string[]> {
  const threadIds = new Set<string>();
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ ...baseParams, maxResults: "500" });
    if (pageToken) params.set("pageToken", pageToken);
    const data = (await gmailFetch(`/messages?${params}`, accessToken)) as {
      messages?: { id: string; threadId: string }[];
      nextPageToken?: string;
    };
    for (const m of data.messages ?? []) {
      if (threadIds.size >= limit) break;
      threadIds.add(m.threadId);
    }
    pageToken = threadIds.size >= limit ? undefined : data.nextPageToken;
  } while (pageToken);

  return [...threadIds];
}

// Every thread in the inbox, read or unread, regardless of label — capped at
// INBOX_SCAN_LIMIT total threads. Unlike "currently unread" (a self-pruning
// set that only shrinks), the full inbox only grows, so re-scanning it in
// full every sync has no natural ceiling — the cap is the ceiling. Gmail's
// list endpoint returns messages newest-first with no explicit sort param
// needed, so capping here means "the N most recently active threads," not
// an arbitrary truncation.
const INBOX_SCAN_LIMIT = 1000;

export async function listInboxThreadIds(accessToken: string): Promise<string[]> {
  return paginatedThreadIds(accessToken, { q: "in:inbox" }, INBOX_SCAN_LIMIT);
}

// Every thread carrying a specific label, regardless of how old — the
// manual-override path (see GmailAccount.syncLabelIds / "Gmail sync" in
// CLAUDE.md): a user-tagged label always gets pulled in and always stays
// eligible for triage, even if it's older than the INBOX_SCAN_LIMIT window
// or Jev classifies it as not recruiting-related. Uses the `labelIds` query
// param (an actual label id) rather than `q: "label:<name>"` (which expects
// the label's display name, not its id) — see listLabels below for where
// that id comes from.
const LABEL_OVERRIDE_SCAN_LIMIT = 500;

export async function listThreadIdsForLabel(accessToken: string, labelId: string): Promise<string[]> {
  return paginatedThreadIds(accessToken, { labelIds: labelId }, LABEL_OVERRIDE_SCAN_LIMIT);
}

export type GmailLabel = { id: string; name: string; type: string };

const SYSTEM_LABEL_ALLOWLIST = new Set(["INBOX", "SENT", "STARRED", "IMPORTANT"]);

/** Filters out Gmail's noisy CATEGORY_ and CHAT system labels — keeps user-created labels plus the handful of system labels someone would plausibly want to pick as the override label. */
export async function listLabels(accessToken: string): Promise<GmailLabel[]> {
  const data = (await gmailFetch("/labels", accessToken)) as { labels?: GmailLabel[] };
  return (data.labels ?? []).filter((l) => l.type === "user" || SYSTEM_LABEL_ALLOWLIST.has(l.id));
}

type GmailMessagePart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
};

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

/** Depth-first search for the first part whose mimeType matches, decoding its body. */
function findPartText(part: GmailMessagePart, mimeType: string): string | null {
  if (part.mimeType === mimeType && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  for (const child of part.parts ?? []) {
    const found = findPartText(child, mimeType);
    if (found) return found;
  }
  return null;
}

/** Plain text if the message has one, else the HTML part with tags stripped. */
function extractMessageText(payload: GmailMessagePart): string {
  const plain = findPartText(payload, "text/plain");
  if (plain) return plain;
  const html = findPartText(payload, "text/html");
  return html ? stripTags(html) : "";
}

const MAX_THREAD_BODY_CHARS = 20_000;

/**
 * Full message bodies for every message in a thread, fetched and decoded on
 * the fly for Jev classification — never persisted (EmailThread only ever
 * stores subject/snippet, per the read-only/metadata-only design). Bounded
 * in length for the same reason urlFetch.ts caps fetched page size: this
 * feeds an LLM-adjacent call, not unbounded internal processing.
 */
export async function getThreadBodyText(accessToken: string, threadId: string): Promise<string> {
  const data = (await gmailFetch(`/threads/${threadId}?format=full`, accessToken)) as {
    messages?: { payload?: GmailMessagePart }[];
  };

  const texts = (data.messages ?? [])
    .map((m) => (m.payload ? extractMessageText(m.payload) : ""))
    .filter(Boolean);

  return texts.join("\n\n---\n\n").slice(0, MAX_THREAD_BODY_CHARS);
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
