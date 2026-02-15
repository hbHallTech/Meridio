import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  generateStrongPassword,
  calculatePasswordExpiresAt,
  buildPasswordHistory,
} from "@/lib/password";
import {
  sendPasswordExpiringSoonEmail,
  sendPasswordExpiredResetEmail,
} from "@/lib/email";
import {
  notifyPasswordExpiringSoon,
  notifyPasswordAutoReset,
  createAuditLog,
} from "@/lib/notifications";

/**
 * Daily cron job for password expiration management.
 * - Sends alerts 5 days before expiration
 * - Auto-resets expired passwords with a temporary one
 *
 * Secure with CRON_SECRET env variable.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel cron or custom)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const fiveDaysFromNow = new Date();
  fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

  let alertsSent = 0;
  let passwordsReset = 0;

  // ── 1. Alert users whose password expires within 5 days ──
  const expiringUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      passwordExpiresAt: {
        gt: now,
        lte: fiveDaysFromNow,
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      passwordExpiresAt: true,
    },
  });

  for (const user of expiringUsers) {
    const daysLeft = Math.ceil(
      (user.passwordExpiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    await notifyPasswordExpiringSoon(user.id, daysLeft).catch(() => {});
    await sendPasswordExpiringSoonEmail(
      user.email,
      user.firstName,
      daysLeft
    ).catch(() => {});

    alertsSent++;
  }

  // ── 2. Auto-reset expired passwords ──
  const expiredUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      passwordExpiresAt: {
        lte: now,
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      passwordHistory: true,
    },
  });

  for (const user of expiredUsers) {
    const tempPassword = generateStrongPassword();
    const newHash = await bcrypt.hash(tempPassword, 12);
    const newHistory = buildPasswordHistory(
      newHash,
      (user.passwordHistory as string[] | null) ?? null
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        passwordExpiresAt: calculatePasswordExpiresAt(),
        lastPasswordChangeAt: now,
        forcePasswordChange: true,
        passwordHistory: newHistory,
      },
    });

    await notifyPasswordAutoReset(user.id).catch(() => {});
    await sendPasswordExpiredResetEmail(
      user.email,
      user.firstName,
      tempPassword
    ).catch(() => {});

    await createAuditLog({
      userId: user.id,
      action: "PASSWORD_AUTO_RESET",
      entityType: "User",
      entityId: user.id,
      newValue: { reason: "cron_password_expired" },
    }).catch(() => {});

    passwordsReset++;
  }

  return NextResponse.json({
    success: true,
    alertsSent,
    passwordsReset,
    timestamp: now.toISOString(),
  });
}
