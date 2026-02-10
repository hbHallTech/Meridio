import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { send2FACode } from "@/lib/email";
import crypto from "crypto";

export async function POST() {
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
    },
  });

  await send2FACode(user.email, code, user.firstName);

  return NextResponse.json({ message: "Code envoyé" });
}
