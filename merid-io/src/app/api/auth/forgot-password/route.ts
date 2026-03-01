import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validators";
import { sendPasswordResetEmail } from "@/lib/email";
import { logAudit, getIp } from "@/lib/audit";
import { checkBotId } from "botid/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  // Vercel BotID – block automated requests
  const botCheck = await checkBotId();
  if (botCheck.isBot && !botCheck.isVerifiedBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // Always return success to prevent email enumeration
  const successResponse = NextResponse.json({
    message: "Si l'adresse existe, un email de réinitialisation a été envoyé.",
  });

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase().trim() },
  });

  if (!user || !user.isActive) {
    return successResponse;
  }

  const token = crypto.randomBytes(32).toString("hex");
  // H2: Store SHA-256 hash of token in DB, send raw token via email
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetPasswordToken: tokenHash,
      resetPasswordExpiry: expiry,
    },
  });

  await sendPasswordResetEmail(user.email, token, user.firstName);

  logAudit(user.id, "PASSWORD_RESET_REQUESTED", {
    entityType: "User",
    entityId: user.id,
    ip: getIp(request.headers),
  });

  return successResponse;
}
