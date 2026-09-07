import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export function generateApiToken(): { token: string; tokenHash: string } {
  const token = `rp_${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashApiToken(token) };
}

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function getUserIdFromBearerToken(
  req: Request
): Promise<string | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  const tokenHash = hashApiToken(token);
  const apiToken = await prisma.apiToken.findUnique({ where: { tokenHash } });
  if (!apiToken) return null;
  if (apiToken.revokedAt) return null;
  if (apiToken.expiresAt && apiToken.expiresAt < new Date()) return null;

  await prisma.apiToken.update({
    where: { id: apiToken.id },
    data: { lastUsedAt: new Date() },
  });

  return apiToken.userId;
}
