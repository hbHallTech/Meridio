import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { send2FACode } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import crypto from "crypto";

export async function POST() {
  try {
    if (!process.env.SMTP_USER) {
      return NextResponse.json({ skipped: true });
    }

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

    try {
      await send2FACode(user.email, code, user.firstName);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[2FA] Failed to send code to ${user.email}: ${errMsg}`);
      return NextResponse.json(
        { error: "Impossible d'envoyer le code de vérification. Veuillez réessayer." },
        { status: 502 }
      );
    }

    logAudit(session.user.id, "2FA_CODE_SENT", {
      entityType: "User",
      entityId: session.user.id,
    });

    return NextResponse.json({ message: "Code envoyé" });
  } catch (err) {
    console.error("[2fa/send] Unhandled error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Une erreur interne est survenue. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
