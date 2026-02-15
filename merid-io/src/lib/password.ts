import bcrypt from "bcryptjs";
import crypto from "crypto";

const PASSWORD_EXPIRY_DAYS = 90;
const PASSWORD_HISTORY_SIZE = 5;

/**
 * Generate a cryptographically strong password (12+ chars)
 * with uppercase, lowercase, digits, and special characters.
 */
export function generateStrongPassword(length = 16): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*?";

  // Guarantee at least one of each type
  const required = [
    upper[crypto.randomInt(upper.length)],
    lower[crypto.randomInt(lower.length)],
    digits[crypto.randomInt(digits.length)],
    special[crypto.randomInt(special.length)],
  ];

  const all = upper + lower + digits + special;
  const remaining = Array.from({ length: length - required.length }, () =>
    all[crypto.randomInt(all.length)]
  );

  // Shuffle using Fisher-Yates
  const chars = [...required, ...remaining];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

/**
 * Check if a plain-text password matches any of the hashes in history.
 * Returns true if the password was already used (should be rejected).
 */
export async function isPasswordInHistory(
  plainPassword: string,
  history: string[]
): Promise<boolean> {
  for (const hash of history) {
    const match = await bcrypt.compare(plainPassword, hash);
    if (match) return true;
  }
  return false;
}

/**
 * Build an updated password history array, keeping only the last N hashes.
 */
export function buildPasswordHistory(
  currentHash: string,
  existingHistory: string[] | null
): string[] {
  const history = existingHistory ? [...existingHistory] : [];
  history.push(currentHash);
  // Keep only the last PASSWORD_HISTORY_SIZE entries
  return history.slice(-PASSWORD_HISTORY_SIZE);
}

/**
 * Calculate the password expiration date (now + 90 days).
 */
export function calculatePasswordExpiresAt(): Date {
  const date = new Date();
  date.setDate(date.getDate() + PASSWORD_EXPIRY_DAYS);
  return date;
}

/**
 * Check if a password is expiring within `daysThreshold` days.
 */
export function isPasswordExpiringSoon(
  expiresAt: Date | null,
  daysThreshold = 5
): boolean {
  if (!expiresAt) return false;
  const now = new Date();
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + daysThreshold);
  return expiresAt > now && expiresAt <= threshold;
}

/**
 * Check if a password has expired.
 */
export function isPasswordExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return expiresAt <= new Date();
}
