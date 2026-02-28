import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }
  // Key must be 32 bytes for AES-256
  return crypto.createHash("sha256").update(key).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64 string: iv:encrypted:authTag
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${encrypted}:${authTag.toString("hex")}`;
}

/**
 * Decrypt a string encrypted with encrypt().
 */
export function decrypt(encryptedString: string): string {
  const key = getEncryptionKey();
  const [ivHex, encrypted, authTagHex] = encryptedString.split(":");

  if (!ivHex || !encrypted || !authTagHex) {
    throw new Error("Invalid encrypted string format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Try to decrypt; if the value was stored before encryption was enabled
 * (plain text, not in iv:encrypted:tag format), return it as-is with a warning.
 * This provides backward compatibility during migration.
 */
export function decryptOrFallback(value: string, label: string): string {
  // Encrypted values always have the format "hex:hex:hex" (iv:data:tag)
  const parts = value.split(":");
  if (parts.length !== 3) {
    console.warn(`[crypto] ${label} is not encrypted (legacy plain-text) — re-save to encrypt`);
    return value;
  }
  try {
    return decrypt(value);
  } catch {
    // Could be a plain-text value that happens to contain colons, or wrong key
    console.warn(`[crypto] ${label} decryption failed — using as plain-text (re-save to fix)`);
    return value;
  }
}
