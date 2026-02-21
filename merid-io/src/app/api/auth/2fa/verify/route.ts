import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verify2FASchema } from "@/lib/validators";
import { logAudit, getIp } from "@/lib/audit";

export async function POST(request: NextRequest) {
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

  if (user.twoFactorExpiry < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorCode: null, twoFactorExpiry: null },
    });
    return NextResponse.json({ error: "Code expiré" }, { status: 400 });
  }

  if (user.twoFactorCode !== parsed.data.code) {
    logAudit(session.user.id, "2FA_FAILED", {
      success: false,
      entityType: "User",
      entityId: session.user.id,
      ip: getIp(request.headers),
    });
    return NextResponse.json({ error: "Code invalide" }, { status: 400 });
  }

  // Clear 2FA code
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorCode: null, twoFactorExpiry: null },
  });

  logAudit(session.user.id, "2FA_VERIFIED", {
    entityType: "User",
    entityId: session.user.id,
    ip: getIp(request.headers),
  });

  return NextResponse.json({ verified: true });
}
