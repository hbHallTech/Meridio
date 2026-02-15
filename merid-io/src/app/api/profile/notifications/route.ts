import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const prefs = await prisma.userNotificationPref.findMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json(prefs);
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { settings } = body;

    if (!Array.isArray(settings)) {
      return NextResponse.json({ error: "Format invalide" }, { status: 400 });
    }

    for (const s of settings) {
      await prisma.userNotificationPref.upsert({
        where: { userId_type: { userId: session.user.id, type: s.type } },
        update: { enabled: s.enabled },
        create: { userId: session.user.id, type: s.type, enabled: s.enabled },
      });
    }

    const prefs = await prisma.userNotificationPref.findMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json(prefs);
  } catch (error) {
    console.error("PATCH /api/profile/notifications error:", error);
    return NextResponse.json({ error: "Erreur lors de la sauvegarde" }, { status: 500 });
  }
}
