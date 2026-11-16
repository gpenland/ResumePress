import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

export type GmailConnectionStatus =
  | { connected: false }
  | { connected: true; email: string; connectedAt: Date; lastSyncAt: Date | null; needsReauth: boolean };

export async function getGmailConnectionStatus(userId: string): Promise<GmailConnectionStatus> {
  const account = await prisma.gmailAccount.findUnique({ where: { userId } });
  if (!account) return { connected: false };
  return {
    connected: true,
    email: account.email,
    connectedAt: account.connectedAt,
    lastSyncAt: account.lastSyncAt,
    needsReauth: account.needsReauth,
  };
}

/** Cheap check for the nav/layout banner — no decryption, no Gmail call. */
export async function gmailNeedsReauth(userId: string): Promise<boolean> {
  const account = await prisma.gmailAccount.findUnique({ where: { userId }, select: { needsReauth: true } });
  return account?.needsReauth ?? false;
}

export async function markGmailNeedsReauth(userId: string): Promise<void> {
  await prisma.gmailAccount.updateMany({ where: { userId, needsReauth: false }, data: { needsReauth: true, reauthAt: new Date() } });
}

export async function clearGmailNeedsReauth(userId: string): Promise<void> {
  await prisma.gmailAccount.updateMany({ where: { userId, needsReauth: true }, data: { needsReauth: false, reauthAt: null } });
}

export async function saveGmailAccount(
  userId: string,
  data: { email: string; refreshToken: string; scopes: string[] }
): Promise<void> {
  const existing = await prisma.gmailAccount.findUnique({ where: { userId }, select: { email: true } });
  const differentMailbox =
    existing && data.email !== "unknown" && existing.email !== "unknown" && existing.email.toLowerCase() !== data.email.toLowerCase();
  if (differentMailbox) {
    await prisma.gmailAccount.update({ where: { userId }, data: { lastSyncAt: null, syncLabelIds: [] } });
  }
  await prisma.gmailAccount.upsert({
    where: { userId },
    create: {
      userId,
      email: data.email,
      encryptedRefreshToken: encrypt(data.refreshToken),
      scopes: data.scopes,
    },
    // Reconnecting an existing row (an expired token, same mailbox) keeps
    // lastSyncAt/syncLabelIds so the next sync is a normal incremental
    // catch-up, not a first-sync full inbox rescan. A different mailbox's
    // history would be wrong to anchor to, so that resets lastSyncAt.
    update: {
      email: data.email,
      encryptedRefreshToken: encrypt(data.refreshToken),
      scopes: data.scopes,
      needsReauth: false,
      reauthAt: null,
      syncStatus: "idle",
      syncStartedAt: null,
      syncError: null,
    },
  });
}

/** Decrypted refresh token, for the sync logic that lands in Phase 2C. Not used by the Phase 1 skeleton. */
export async function getDecryptedRefreshToken(userId: string): Promise<string | null> {
  const account = await prisma.gmailAccount.findUnique({ where: { userId } });
  if (!account) return null;
  return decrypt(account.encryptedRefreshToken);
}

export async function disconnectGmailAccount(userId: string): Promise<void> {
  await prisma.gmailAccount.deleteMany({ where: { userId } });
}

/** Every connected user, for the cron-triggered sync (`/api/cron/gmail-sync`) to loop over. */
export async function listAllGmailAccountUserIds(): Promise<string[]> {
  const accounts = await prisma.gmailAccount.findMany({ select: { userId: true } });
  return accounts.map((a) => a.userId);
}
