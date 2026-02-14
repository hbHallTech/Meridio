import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "report:view")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? new Date().getFullYear().toString(), 10);
  const officeFilter = searchParams.get("office") ?? "";
  const teamFilter = searchParams.get("team") ?? "";
  const leaveTypeFilter = searchParams.get("leaveType") ?? "";
  const employeeFilter = searchParams.get("employee") ?? "";
  const statusFilter = searchParams.get("status") ?? "";

  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);

  // Build user filter
  const userWhere: Record<string, unknown> = { isActive: true };
  if (officeFilter) userWhere.officeId = officeFilter;
  if (teamFilter) userWhere.teamId = teamFilter;

  let users = await prisma.user.findMany({
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

  if (employeeFilter) {
    users = users.filter((u) => u.id === employeeFilter);
  }

  const userIds = users.map((u) => u.id);

  // Fetch leave data
  const leaveWhere: Record<string, unknown> = {
    userId: { in: userIds },
    startDate: { lte: endOfYear },
    endDate: { gte: startOfYear },
  };
  if (statusFilter) {
    leaveWhere.status = statusFilter;
  } else {
    leaveWhere.status = "APPROVED";
  }
  if (leaveTypeFilter) {
    leaveWhere.leaveTypeConfigId = leaveTypeFilter;
  }

  const leaves = await prisma.leaveRequest.findMany({
    where: leaveWhere,
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      leaveTypeConfig: {
        select: { id: true, code: true, label_fr: true, label_en: true, color: true },
      },
    },
  });

  // Get all leave types
  const leaveTypes = await prisma.leaveTypeConfig.findMany({
    where: { isActive: true },
    select: { id: true, code: true, label_fr: true, label_en: true, color: true },
    distinct: ["code"],
  });

  // Balances
  const balances = await prisma.leaveBalance.findMany({
    where: { userId: { in: userIds }, year },
  });

  // Build per-employee summary
  const employeeSummary = users.map((user) => {
    const userLeaves = leaves.filter((l) => l.userId === user.id);
    const userBalances = balances.filter((b) => b.userId === user.id);

    const daysByType: Record<string, { code: string; label_fr: string; label_en: string; color: string; days: number }> = {};
    for (const lt of leaveTypes) {
      const total = userLeaves
        .filter((l) => l.leaveTypeConfig.code === lt.code)
        .reduce((sum, l) => sum + l.totalDays, 0);
      daysByType[lt.code] = {
        code: lt.code,
        label_fr: lt.label_fr,
        label_en: lt.label_en,
        color: lt.color,
        days: total,
      };
    }

    const totalDaysTaken = userLeaves.reduce((sum, l) => sum + l.totalDays, 0);
    const annual = userBalances.find((b) => b.balanceType === "ANNUAL");
    const offered = userBalances.find((b) => b.balanceType === "OFFERED");

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      office: user.office,
      team: user.team,
      daysByType,
      totalDaysTaken,
      annualBalance: annual
        ? {
            total: annual.totalDays + annual.carriedOverDays,
            used: annual.usedDays,
            pending: annual.pendingDays,
            remaining: annual.totalDays + annual.carriedOverDays - annual.usedDays - annual.pendingDays,
          }
        : null,
      offeredBalance: offered
        ? {
            total: offered.totalDays,
            used: offered.usedDays,
            pending: offered.pendingDays,
            remaining: offered.totalDays - offered.usedDays - offered.pendingDays,
          }
        : null,
    };
  });

  // Filters data
  const offices = await prisma.office.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const teams = await prisma.team.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    year,
    employees: employeeSummary,
    leaveTypes,
    allEmployees: users.map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName })),
    offices,
    teams,
  });
}
