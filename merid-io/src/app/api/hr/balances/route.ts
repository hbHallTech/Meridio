import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

// GET: list all employee balances with filters
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "hr:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? new Date().getFullYear().toString(), 10);
  const officeFilter = searchParams.get("office") ?? "";
  const teamFilter = searchParams.get("team") ?? "";

  // Build user filter
  const userWhere: Record<string, unknown> = { isActive: true };
  if (officeFilter) userWhere.officeId = officeFilter;
  if (teamFilter) userWhere.teamId = teamFilter;

  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      office: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const userIds = users.map((u) => u.id);

  const balances = await prisma.leaveBalance.findMany({
    where: {
      userId: { in: userIds },
      year,
    },
  });

  const balanceMap = new Map<string, typeof balances>();
  for (const b of balances) {
    const existing = balanceMap.get(b.userId) ?? [];
    existing.push(b);
    balanceMap.set(b.userId, existing);
  }

  const employees = users.map((u) => {
    const userBalances = balanceMap.get(u.id) ?? [];
    const annual = userBalances.find((b) => b.balanceType === "ANNUAL");
    const offered = userBalances.find((b) => b.balanceType === "OFFERED");

    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      office: u.office,
      team: u.team,
      annualBalance: annual
        ? {
            id: annual.id,
            total: annual.totalDays + annual.carriedOverDays,
            used: annual.usedDays,
            pending: annual.pendingDays,
            remaining: annual.totalDays + annual.carriedOverDays - annual.usedDays - annual.pendingDays,
            carriedOver: annual.carriedOverDays,
          }
        : null,
      offeredBalance: offered
        ? {
            id: offered.id,
            total: offered.totalDays,
            used: offered.usedDays,
            pending: offered.pendingDays,
            remaining: offered.totalDays - offered.usedDays - offered.pendingDays,
          }
        : null,
    };
  });

  // Get offices and teams for filters
  const allOffices = await prisma.office.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const allTeams = await prisma.team.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Get adjustment history
  const adjustments = await prisma.auditLog.findMany({
    where: {
      action: "BALANCE_ADJUSTED",
      createdAt: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Enrich adjustments with user names
  const adjustmentUserIds = [...new Set(adjustments.map((a) => a.userId))];
  const adjustmentUsers = await prisma.user.findMany({
    where: { id: { in: adjustmentUserIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const adjustmentUserMap = new Map(adjustmentUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const adjustmentHistory = adjustments.map((a) => ({
    id: a.id,
    byUser: adjustmentUserMap.get(a.userId) ?? "Unknown",
    entityId: a.entityId,
    oldValue: a.oldValue,
    newValue: a.newValue,
    createdAt: a.createdAt,
  }));

  return NextResponse.json({
    employees,
    offices: allOffices,
    teams: allTeams,
    adjustmentHistory,
    year,
  });
}

// POST: adjust a balance
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "hr:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  const { balanceId, newTotalDays, reason } = body;

  if (!balanceId || newTotalDays === undefined || !reason) {
    return NextResponse.json(
      { error: "balanceId, newTotalDays et reason sont obligatoires" },
      { status: 400 }
    );
  }

  const balance = await prisma.leaveBalance.findUnique({
    where: { id: balanceId },
  });

  if (!balance) {
    return NextResponse.json({ error: "Solde introuvable" }, { status: 404 });
  }

  const oldTotal = balance.totalDays;

  await prisma.leaveBalance.update({
    where: { id: balanceId },
    data: { totalDays: newTotalDays },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "BALANCE_ADJUSTED",
      entityType: "LeaveBalance",
      entityId: balanceId,
      oldValue: { totalDays: oldTotal, reason: "" },
      newValue: { totalDays: newTotalDays, reason },
    },
  });

  return NextResponse.json({ success: true });
}
