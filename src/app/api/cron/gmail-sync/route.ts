import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { listAllGmailAccountUserIds } from "@/lib/gmailAccount";
import { syncGmailForUser, type SyncResult } from "@/lib/emailThreads";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if the deployment never set one

  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length).trim();

  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/**
 * Triggered on a schedule by a Sevalla `cron` process (see CLAUDE.md "Gmail
 * sync") instead of a user clicking "Sync now". Loops every connected
 * GmailAccount and runs the same `syncGmailForUser` the manual action uses;
 * one account's failure never aborts the rest of the batch.
 */
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userIds = await listAllGmailAccountUserIds();
  const results: Record<string, SyncResult> = {};

  for (const userId of userIds) {
    try {
      results[userId] = await syncGmailForUser(userId);
    } catch (err) {
      results[userId] = { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  const succeeded = Object.values(results).filter((r) => r.ok).length;
  return NextResponse.json({ accounts: userIds.length, succeeded, results });
}
