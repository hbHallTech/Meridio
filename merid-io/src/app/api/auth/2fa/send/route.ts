import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { send2FACode } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import crypto from "crypto";

export async function POST() {
  try {
    if (!process.env.SMTP_USER) {
      console.log("[2fa/send] SMTP_USER not set — skipping 2FA");
      return NextResponse.json({ skipped: true });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    console.log(`[2fa/send] Sending code for user=${session.user.id}`);

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
      console.error(`[2fa/send] SMTP FAILED for ${user.email}: ${errMsg}`);

      logAudit(session.user.id, "2FA_SEND_FAILED", {
        entityType: "User",
        entityId: session.user.id,
      });

      return NextResponse.json(
        { error: "Échec de l'envoi du code de vérification. Veuillez réessayer ou contacter le support." },
        { status: 502 }
      );
    }

    logAudit(session.user.id, "2FA_CODE_SENT", {
      entityType: "User",
      entityId: session.user.id,
    });

    console.log(`[2fa/send] Code sent successfully to ${user.email}`);
    return NextResponse.json({ message: "Code envoyé" });
  } catch (err) {
    console.error("[2fa/send] Unhandled error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Une erreur interne est survenue. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
