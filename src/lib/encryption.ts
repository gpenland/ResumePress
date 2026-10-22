import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM, used only for Gmail refresh tokens (see docs/MIGRATION_PLAN.md
// §1.1 — this key is intentionally separate from AUTH_SECRET). Encoded output
// is base64(iv) + "." + base64(authTag) + "." + base64(ciphertext) so
// decrypt() has everything it needs without a second lookup.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const key = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY is not set");
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY must decode to 32 bytes (base64-encoded)");
  }
  return buf;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    "."
  );
}

export function decrypt(encoded: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(".");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted value");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf-8");
}
