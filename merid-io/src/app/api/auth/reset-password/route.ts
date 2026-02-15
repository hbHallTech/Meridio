import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validators";
import {
  isPasswordInHistory,
  buildPasswordHistory,
  calculatePasswordExpiresAt,
} from "@/lib/password";
import { createAuditLog } from "@/lib/notifications";
import { getRequestIp } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request.headers);
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  const body = await request.json();
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      resetPasswordToken: parsed.data.token,
      resetPasswordExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Lien invalide ou expire" },
      { status: 400 }
    );
  }

  // Check password history
  const history = (user.passwordHistory as string[] | null) ?? [];
  const isReused = await isPasswordInHistory(parsed.data.password, history);
  if (isReused) {
    return NextResponse.json(
      {
        error:
          "Ce mot de passe a deja ete utilise recemment. Veuillez en choisir un nouveau.",
      },
      { status: 400 }
    );
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12);
  const newHistory = await buildPasswordHistory(hashedPassword, history);
  const expiresAt = await calculatePasswordExpiresAt();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpiry: null,
      passwordChangedAt: new Date(),
      lastPasswordChangeAt: new Date(),
      passwordExpiresAt: expiresAt,
      passwordHistory: newHistory,
      failedLoginAttempts: 0,
      lockedUntil: null,
      forcePasswordChange: false,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "PASSWORD_RESET",
    entityType: "User",
    entityId: user.id,
    ipAddress: ip,
    newValue: { method: "reset_token", userAgent },
  }).catch(() => {});

  return NextResponse.json({
    message: "Mot de passe reinitialise avec succes",
  });
}
