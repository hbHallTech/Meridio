import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("HR") && !roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const officeId = searchParams.get("officeId") || undefined;
  const teamId = searchParams.get("teamId") || undefined;
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);

  const where: Record<string, unknown> = { isActive: true };
  if (officeId) where.officeId = officeId;
  if (teamId) where.teamId = teamId;

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      office: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      leaveBalances: {
        where: { year },
        select: {
          balanceType: true,
          totalDays: true,
          usedDays: true,
          pendingDays: true,
          carriedOverDays: true,
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const items = users.map((u) => {
    const annual = u.leaveBalances.find((b) => b.balanceType === "ANNUAL");
    const offered = u.leaveBalances.find((b) => b.balanceType === "OFFERED");
    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      office: u.office,
      team: u.team,
      annual: annual
        ? {
            total: annual.totalDays,
            used: annual.usedDays,
            pending: annual.pendingDays,
            remaining: annual.totalDays + annual.carriedOverDays - annual.usedDays - annual.pendingDays,
            carriedOver: annual.carriedOverDays,
          }
        : null,
      offered: offered
        ? {
            total: offered.totalDays,
            used: offered.usedDays,
            pending: offered.pendingDays,
            remaining: offered.totalDays - offered.usedDays - offered.pendingDays,
          }
        : null,
    };
  });

  // Also return filter options
  const [offices, teams] = await Promise.all([
    prisma.office.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.team.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({ items, offices, teams, year });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];
  if (!roles.includes("HR") && !roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, balanceType, adjustment, reason } = body;

  if (!userId || !balanceType || adjustment === undefined || !reason) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const year = new Date().getFullYear();

  const balance = await prisma.leaveBalance.findFirst({
    where: { userId, year, balanceType },
  });

  if (!balance) {
    return NextResponse.json({ error: "Solde introuvable" }, { status: 404 });
  }

  const newTotal = balance.totalDays + parseFloat(adjustment);
  if (newTotal < 0) {
    return NextResponse.json({ error: "Le solde ne peut pas etre negatif" }, { status: 400 });
  }

  await prisma.leaveBalance.update({
    where: { id: balance.id },
    data: { totalDays: newTotal },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "BALANCE_ADJUSTED",
      entityType: "LeaveBalance",
      entityId: balance.id,
      oldValue: { totalDays: balance.totalDays },
      newValue: { totalDays: newTotal, adjustment: parseFloat(adjustment), reason, targetUserId: userId, balanceType },
    },
  });

  return NextResponse.json({ success: true, newTotal });
}
