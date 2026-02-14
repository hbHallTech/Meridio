import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ─── GET: user profile with balances ───

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      profilePictureUrl: true,
      language: true,
      hireDate: true,
      roles: true,
      officeId: true,
      teamId: true,
      office: { select: { id: true, name: true, city: true, country: true } },
      team: { select: { id: true, name: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const currentYear = new Date().getFullYear();
  const balances = await prisma.leaveBalance.findMany({
    where: { userId: session.user.id, year: currentYear },
    orderBy: { balanceType: "asc" },
  });

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePictureUrl: user.profilePictureUrl,
      language: user.language,
      hireDate: user.hireDate,
      roles: user.roles,
      office: user.office,
      team: user.team,
    },
    balances: balances.map((b) => ({
      balanceType: b.balanceType,
      year: b.year,
      totalDays: b.totalDays,
      usedDays: b.usedDays,
      pendingDays: b.pendingDays,
      carriedOverDays: b.carriedOverDays,
      remaining: b.totalDays + b.carriedOverDays - b.usedDays - b.pendingDays,
    })),
  });
}

// ─── PATCH: update language or theme preference ───

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();
  const { language, theme } = body;

  const updateData: Record<string, string> = {};

  if (language) {
    if (!["fr", "en"].includes(language)) {
      return NextResponse.json({ error: "Langue invalide" }, { status: 400 });
    }
    updateData.language = language;
  }

  if (theme) {
    if (!["light", "dark", "system"].includes(theme)) {
      return NextResponse.json({ error: "Thème invalide" }, { status: 400 });
    }
    updateData.theme = theme;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
  });

  return NextResponse.json(updateData);
}
