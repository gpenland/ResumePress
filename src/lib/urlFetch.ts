// SSRF-guarded fetch of an arbitrary external URL. The first place in this
// codebase that fetches a user-supplied host rather than a fixed, known one
// (gmail.ts, jev.ts, Google OAuth all hit hardcoded hosts) — treat any change
// here as security-sensitive.

import { lookup } from "node:dns/promises";
import { isIPv4 } from "node:net";

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const USER_AGENT = "ResumePress/1.0 (+job posting autofill; server-side fetch)";

function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
  if (a === 0) return true; // "this network"
  return false;
}

function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true; // loopback
  if (/^fe[89ab][0-9a-f]:/.test(normalized)) return true; // fe80::/10 link-local
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true; // fc00::/7 unique local
  if (normalized.startsWith("::ffff:")) {
    // IPv4-mapped IPv6 — validate the embedded IPv4 address too.
    const mapped = normalized.replace("::ffff:", "");
    if (isIPv4(mapped)) return isPrivateOrReservedIPv4(mapped);
  }
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  const addresses = await lookup(hostname, { all: true });
  if (addresses.length === 0) throw new Error("Could not resolve host.");
  for (const { address, family } of addresses) {
    const isPrivate = family === 4 ? isPrivateOrReservedIPv4(address) : isPrivateOrReservedIPv6(address);
    if (isPrivate) throw new Error("That URL points to a private or internal address.");
  }
}

export type FetchResult = { ok: true; html: string; finalUrl: string } | { ok: false; error: string };

export async function fetchExternalUrl(rawUrl: string): Promise<FetchResult> {
  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") {
      return { ok: false, error: "Only http/https URLs are supported." };
    }

    try {
      await assertPublicHost(current.hostname);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not validate that URL's host." };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      });
    } catch {
      return { ok: false, error: "Could not reach that URL." };
    } finally {
      clearTimeout(timeout);
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      // Re-resolve against `current` (handles relative Location headers) and
      // re-validate the new host on the next loop iteration — never trust a
      // redirect target without re-checking it.
      current = new URL(res.headers.get("location")!, current);
      continue;
    }

    if (!res.ok) {
      return { ok: false, error: `That URL returned an error (${res.status}).` };
    }

    const reader = res.body?.getReader();
    if (!reader) return { ok: false, error: "Empty response." };

    const decoder = new TextDecoder();
    let html = "";
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        return { ok: false, error: "That page is too large to fetch." };
      }
      html += decoder.decode(value, { stream: true });
    }

    return { ok: true, html, finalUrl: current.toString() };
  }

  return { ok: false, error: "Too many redirects." };
}
