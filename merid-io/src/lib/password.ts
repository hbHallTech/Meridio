import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// Default values (used when DB is unavailable)
const DEFAULT_PASSWORD_EXPIRY_DAYS = 90;
const DEFAULT_PASSWORD_HISTORY_SIZE = 5;
const DEFAULT_PASSWORD_MIN_LENGTH = 12;

export interface PasswordPolicy {
  pwdExpirationEnabled: boolean;
  pwdMaxAgeDays: number;
  pwdExpiryAlertDays: number;
  pwdMinLength: number;
  pwdRequireLowercase: boolean;
  pwdRequireUppercase: boolean;
  pwdRequireDigit: boolean;
  pwdRequireSpecial: boolean;
  pwdHistoryCount: number;
  pwdForceChangeOnFirst: boolean;
  pwdCheckDictionary: boolean;
}

/**
 * Fetch the password policy from the Company record (singleton).
 * Falls back to hardcoded defaults if DB is unavailable.
 */
export async function getPasswordPolicy(): Promise<PasswordPolicy> {
  try {
    const company = await prisma.company.findFirst({
      select: {
        pwdExpirationEnabled: true,
        pwdMaxAgeDays: true,
        pwdExpiryAlertDays: true,
        pwdMinLength: true,
        pwdRequireLowercase: true,
        pwdRequireUppercase: true,
        pwdRequireDigit: true,
        pwdRequireSpecial: true,
        pwdHistoryCount: true,
        pwdForceChangeOnFirst: true,
        pwdCheckDictionary: true,
      },
    });

    if (company) return company;
  } catch {
    // DB not available — use defaults
  }

  return {
    pwdExpirationEnabled: true,
    pwdMaxAgeDays: DEFAULT_PASSWORD_EXPIRY_DAYS,
    pwdExpiryAlertDays: 5,
    pwdMinLength: DEFAULT_PASSWORD_MIN_LENGTH,
    pwdRequireLowercase: true,
    pwdRequireUppercase: true,
    pwdRequireDigit: true,
    pwdRequireSpecial: true,
    pwdHistoryCount: DEFAULT_PASSWORD_HISTORY_SIZE,
    pwdForceChangeOnFirst: true,
    pwdCheckDictionary: false,
  };
}

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
 * Reads history size from DB policy.
 */
export async function buildPasswordHistory(
  currentHash: string,
  existingHistory: string[] | null
): Promise<string[]> {
  const policy = await getPasswordPolicy();
  const history = existingHistory ? [...existingHistory] : [];
  history.push(currentHash);
  return history.slice(-policy.pwdHistoryCount);
}

/**
 * Calculate the password expiration date based on DB policy.
 */
export async function calculatePasswordExpiresAt(): Promise<Date> {
  const policy = await getPasswordPolicy();
  const date = new Date();
  if (policy.pwdExpirationEnabled) {
    date.setDate(date.getDate() + policy.pwdMaxAgeDays);
  } else {
    // If expiration disabled, set far future
    date.setFullYear(date.getFullYear() + 100);
  }
  return date;
}

/**
 * Check if a password is expiring within the configured alert threshold.
 */
export async function isPasswordExpiringSoon(
  expiresAt: Date | null,
  daysThreshold?: number
): Promise<boolean> {
  if (!expiresAt) return false;
  const threshold = daysThreshold ?? (await getPasswordPolicy()).pwdExpiryAlertDays;
  const now = new Date();
  const alertDate = new Date();
  alertDate.setDate(alertDate.getDate() + threshold);
  return expiresAt > now && expiresAt <= alertDate;
}

/**
 * Check if a password has expired.
 */
export function isPasswordExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return expiresAt <= new Date();
}

/**
 * Validate a password against the company policy.
 * Returns an array of error messages (empty = valid).
 */
export async function validatePasswordPolicy(password: string): Promise<string[]> {
  const policy = await getPasswordPolicy();
  const errors: string[] = [];

  if (password.length < policy.pwdMinLength) {
    errors.push(`Minimum ${policy.pwdMinLength} caractères`);
  }
  if (policy.pwdRequireLowercase && !/[a-z]/.test(password)) {
    errors.push("Au moins une minuscule requise");
  }
  if (policy.pwdRequireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Au moins une majuscule requise");
  }
  if (policy.pwdRequireDigit && !/\d/.test(password)) {
    errors.push("Au moins un chiffre requis");
  }
  if (policy.pwdRequireSpecial && !/[^A-Za-z\d\s]/.test(password)) {
    errors.push("Au moins un caractère spécial requis");
  }

  return errors;
}
