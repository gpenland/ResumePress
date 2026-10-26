import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

export type GmailConnectionStatus =
  | { connected: false }
  | { connected: true; email: string; connectedAt: Date; lastSyncAt: Date | null };

export async function getGmailConnectionStatus(userId: string): Promise<GmailConnectionStatus> {
  const account = await prisma.gmailAccount.findUnique({ where: { userId } });
  if (!account) return { connected: false };
  return {
    connected: true,
    email: account.email,
    connectedAt: account.connectedAt,
    lastSyncAt: account.lastSyncAt,
  };
}

export async function saveGmailAccount(
  userId: string,
  data: { email: string; refreshToken: string; scopes: string[] }
): Promise<void> {
  await prisma.gmailAccount.upsert({
    where: { userId },
    create: {
      userId,
      email: data.email,
      encryptedRefreshToken: encrypt(data.refreshToken),
      scopes: data.scopes,
    },
    update: {
      email: data.email,
      encryptedRefreshToken: encrypt(data.refreshToken),
      scopes: data.scopes,
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
