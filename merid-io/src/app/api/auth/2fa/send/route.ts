import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { send2FACode } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import crypto from "crypto";

export async function POST() {
  if (!process.env.SMTP_USER) {
    return NextResponse.json({ skipped: true });
  }

  // BotID check removed — this route requires auth() (valid session),
  // so only authenticated users can reach it. The credentials callback
  // is already protected by BotID client-side. The server-side checkBotId()
  // added 2-5s latency with Deep Analysis, causing SMTP timeouts.

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const code = crypto.randomInt(100000, 999999).toString();
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorCode: code,
      twoFactorExpiry: expiry,
      twoFactorAttempts: 0,
    },
  });

  await send2FACode(user.email, code, user.firstName);

  logAudit(session.user.id, "2FA_CODE_SENT", {
    entityType: "User",
    entityId: session.user.id,
  });

  return NextResponse.json({ message: "Code envoyé" });
}
