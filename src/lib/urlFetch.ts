// SSRF-guarded fetch of an arbitrary external URL. The first place in this
// codebase that fetches a user-supplied host rather than a fixed, known one
// (gmail.ts, jev.ts, Google OAuth all hit hardcoded hosts) — treat any change
// here as security-sensitive.

import { lookup as dnsLookup } from "node:dns/promises";
import { isIPv4, type LookupFunction } from "node:net";
import * as http from "node:http";
import * as https from "node:https";
import type { IncomingMessage } from "node:http";

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

// Resolves `hostname` once, rejects if any returned address is private or
// reserved, and returns that resolved address for the caller to pin the
// actual connection to. Validating a hostname and then letting the network
// layer re-resolve it independently to connect (as a plain DNS-lookup-then-
// fetch does) is a TOCTOU hole: a DNS answer that changes between the two
// lookups (attacker-controlled DNS, TTL=0, round-robin between a public
// decoy and an internal/metadata address) passes validation while the real
// connection goes to the private address. Pinning the one validated address
// for the actual connect (see `pinnedLookup` below) closes that gap.
async function resolvePinnedAddress(hostname: string): Promise<{ address: string; family: number }> {
  const addresses = await dnsLookup(hostname, { all: true });
  if (addresses.length === 0) throw new Error("Could not resolve host.");
  for (const { address, family } of addresses) {
    const isPrivate = family === 4 ? isPrivateOrReservedIPv4(address) : isPrivateOrReservedIPv6(address);
    if (isPrivate) throw new Error("That URL points to a private or internal address.");
  }
  return addresses[0];
}

// A `net.LookupFunction` (the shape `http(s).Agent({ lookup })` expects) that
// always hands back the one address we already resolved and validated,
// instead of letting the agent perform its own independent DNS lookup at
// connect time. The Host header and TLS SNI/certificate check still use the
// original hostname from the request URL — only the actual TCP destination
// is pinned. Node's Happy-Eyeballs connection path calls this with
// `{ all: true }` and expects the `dns.lookup`-style array result rather
// than the single-address `(err, address, family)` form — both must be
// handled or the connection fails with ERR_INVALID_IP_ADDRESS.
function pinnedLookup(address: string, family: number): LookupFunction {
  return ((_hostname: string, options: unknown, callback: (...args: unknown[]) => void) => {
    const wantsAll = typeof options === "object" && options !== null && "all" in options && (options as { all?: boolean }).all;
    if (wantsAll) callback(null, [{ address, family }]);
    else callback(null, address, family);
  }) as LookupFunction;
}

function requestOnce(url: URL, agent: http.Agent | https.Agent, signal: AbortSignal): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const requestFn = url.protocol === "https:" ? https.request : http.request;
    const req = requestFn(url, { agent, signal, headers: { "User-Agent": USER_AGENT, Accept: "text/html" } }, resolve);
    req.on("error", reject);
    req.end();
  });
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

    let pinned: { address: string; family: number };
    try {
      pinned = await resolvePinnedAddress(current.hostname);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not validate that URL's host." };
    }

    const AgentCtor = current.protocol === "https:" ? https.Agent : http.Agent;
    const agent = new AgentCtor({ lookup: pinnedLookup(pinned.address, pinned.family) });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: IncomingMessage;
    try {
      res = await requestOnce(current, agent, controller.signal);
    } catch {
      return { ok: false, error: "Could not reach that URL." };
    } finally {
      clearTimeout(timeout);
    }

    const status = res.statusCode ?? 0;

    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume(); // drain so the socket can close
      // Re-resolve against `current` (handles relative Location headers) and
      // re-validate (and re-pin) the new host on the next loop iteration —
      // never trust a redirect target without re-checking it.
      current = new URL(res.headers.location, current);
      continue;
    }

    if (status === 204) {
      res.resume();
      return { ok: false, error: "Empty response." };
    }

    if (status < 200 || status >= 300) {
      res.resume();
      return { ok: false, error: `That URL returned an error (${status}).` };
    }

    const decoder = new TextDecoder();
    let html = "";
    let bytes = 0;
    try {
      for await (const chunk of res as AsyncIterable<Buffer>) {
        bytes += chunk.byteLength;
        if (bytes > MAX_BYTES) {
          res.destroy();
          return { ok: false, error: "That page is too large to fetch." };
        }
        html += decoder.decode(chunk, { stream: true });
      }
    } catch {
      return { ok: false, error: "Could not reach that URL." };
    }

    return { ok: true, html, finalUrl: current.toString() };
  }

  return { ok: false, error: "Too many redirects." };
}
