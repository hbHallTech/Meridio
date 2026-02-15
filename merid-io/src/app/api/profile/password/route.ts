import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/validators";
import { sendPasswordChangedEmail } from "@/lib/email";
import {
  isPasswordInHistory,
  buildPasswordHistory,
  calculatePasswordExpiresAt,
} from "@/lib/password";
import { notifyPasswordChanged, createAuditLog } from "@/lib/notifications";
import { assertSessionActive } from "@/lib/session-guard";
import { getRequestIp } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await assertSessionActive();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Non authentifie";
    const status = message === "SESSION_INACTIVE" ? 440 : 401;
    return NextResponse.json({ error: message }, { status });
  }

  const ip = getRequestIp(request.headers);
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  const body = await request.json();
  const parsed = changePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      passwordHash: true,
      email: true,
      firstName: true,
      passwordHistory: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Utilisateur introuvable" },
      { status: 404 }
    );
  }

  const isValid = await bcrypt.compare(
    parsed.data.currentPassword,
    user.passwordHash
  );
  if (!isValid) {
    return NextResponse.json(
      { error: "Le mot de passe actuel est incorrect" },
      { status: 400 }
    );
  }

  // Check password history (last 5 passwords)
  const history = (user.passwordHistory as string[] | null) ?? [];
  const isReused = await isPasswordInHistory(parsed.data.newPassword, history);
  if (isReused) {
    return NextResponse.json(
      {
        error:
          "Ce mot de passe a deja ete utilise recemment. Veuillez en choisir un nouveau.",
      },
      { status: 400 }
    );
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  const newHistory = buildPasswordHistory(newHash, history);

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      passwordHash: newHash,
      passwordChangedAt: new Date(),
      lastPasswordChangeAt: new Date(),
      passwordExpiresAt: calculatePasswordExpiresAt(),
      forcePasswordChange: false,
      passwordHistory: newHistory,
    },
  });

  // In-app notification + email
  await notifyPasswordChanged(session.user.id).catch(() => {});
  await sendPasswordChangedEmail(user.email, user.firstName).catch(() => {});

  // Audit log
  await createAuditLog({
    userId: session.user.id,
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: session.user.id,
    ipAddress: ip,
    newValue: { userAgent },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
