import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verify2FASchema } from "@/lib/validators";
import { logAudit, getIp } from "@/lib/audit";
import { isBotRequest } from "@/lib/bot-protection";
import crypto from "crypto";

const MAX_2FA_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  if (await isBotRequest()) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = verify2FASchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  if (!user.twoFactorCode || !user.twoFactorExpiry) {
    return NextResponse.json({ error: "Aucun code en attente" }, { status: 400 });
  }

  // C4: Brute-force protection — max 5 attempts per code
  if (user.twoFactorAttempts >= MAX_2FA_ATTEMPTS) {
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorCode: null, twoFactorExpiry: null, twoFactorAttempts: 0 },
    });
    logAudit(session.user.id, "2FA_LOCKED", {
      success: false,
      entityType: "User",
      entityId: session.user.id,
      ip: getIp(request.headers),
    });
    return NextResponse.json(
      { error: "Trop de tentatives. Veuillez demander un nouveau code." },
      { status: 429 }
    );
  }

  if (user.twoFactorExpiry < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorCode: null, twoFactorExpiry: null, twoFactorAttempts: 0 },
    });
    return NextResponse.json({ error: "Code expiré" }, { status: 400 });
  }

  // C3: Timing-safe comparison to prevent timing attacks
  const codeBuffer = Buffer.from(parsed.data.code.padEnd(6, "0"));
  const storedBuffer = Buffer.from(user.twoFactorCode.padEnd(6, "0"));
  const isValid = crypto.timingSafeEqual(codeBuffer, storedBuffer);

  if (!isValid) {
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorAttempts: { increment: 1 } },
    });
    logAudit(session.user.id, "2FA_FAILED", {
      success: false,
      entityType: "User",
      entityId: session.user.id,
      ip: getIp(request.headers),
    });
    return NextResponse.json({ error: "Code invalide" }, { status: 400 });
  }

  // C1: Set twoFactorVerified server-side (not via client session update)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorCode: null,
      twoFactorExpiry: null,
      twoFactorAttempts: 0,
      twoFactorVerified: true,
    },
  });

  logAudit(session.user.id, "2FA_VERIFIED", {
    entityType: "User",
    entityId: session.user.id,
    ip: getIp(request.headers),
  });

  return NextResponse.json({ verified: true });
}
