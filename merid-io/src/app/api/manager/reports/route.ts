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
  const leaveTypeFilter = searchParams.get("leaveType") ?? "";
  const employeeFilter = searchParams.get("employee") ?? "";

  // Find team members
  const managedTeam = await prisma.team.findUnique({
    where: { managerId: session.user.id },
    include: {
      members: {
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true, officeId: true },
      },
    },
  });

  let teamMembers = managedTeam?.members ?? [];
  if (employeeFilter) {
    teamMembers = teamMembers.filter((m) => m.id === employeeFilter);
  }

  const memberIds = teamMembers.map((m) => m.id);

  // Get leave types for the office
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { officeId: true },
  });

  const leaveTypes = user
    ? await prisma.leaveTypeConfig.findMany({
        where: { officeId: user.officeId, isActive: true },
        select: { id: true, code: true, label_fr: true, label_en: true, color: true },
      })
    : [];

  // Fetch approved leaves for the year
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);

  const whereLeaves: Record<string, unknown> = {
    userId: { in: memberIds },
    status: "APPROVED",
    startDate: { lte: endOfYear },
    endDate: { gte: startOfYear },
  };
  if (leaveTypeFilter) {
    whereLeaves.leaveTypeConfigId = leaveTypeFilter;
  }

  const leaves = await prisma.leaveRequest.findMany({
    where: whereLeaves,
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true },
      },
      leaveTypeConfig: {
        select: { id: true, code: true, label_fr: true, label_en: true, color: true },
      },
    },
  });

  // Fetch balances for the year
  const balances = await prisma.leaveBalance.findMany({
    where: {
      userId: { in: memberIds },
      year,
    },
  });

  // Build per-employee summary
  const employeeSummary = teamMembers.map((member) => {
    const memberLeaves = leaves.filter((l) => l.userId === member.id);
    const memberBalances = balances.filter((b) => b.userId === member.id);

    // Days by leave type
    const daysByType: Record<string, { code: string; label_fr: string; label_en: string; color: string; days: number }> = {};
    for (const lt of leaveTypes) {
      const total = memberLeaves
        .filter((l) => l.leaveTypeConfig.code === lt.code)
        .reduce((sum, l) => sum + l.totalDays, 0);
      if (total > 0 || !leaveTypeFilter) {
        daysByType[lt.code] = {
          code: lt.code,
          label_fr: lt.label_fr,
          label_en: lt.label_en,
          color: lt.color,
          days: total,
        };
      }
    }

    const totalDaysTaken = memberLeaves.reduce((sum, l) => sum + l.totalDays, 0);

    // Balances
    const annualBalance = memberBalances.find((b) => b.balanceType === "ANNUAL");
    const offeredBalance = memberBalances.find((b) => b.balanceType === "OFFERED");

    return {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      daysByType,
      totalDaysTaken,
      annualBalance: annualBalance
        ? {
            total: annualBalance.totalDays + annualBalance.carriedOverDays,
            used: annualBalance.usedDays,
            pending: annualBalance.pendingDays,
            remaining:
              annualBalance.totalDays +
              annualBalance.carriedOverDays -
              annualBalance.usedDays -
              annualBalance.pendingDays,
          }
        : null,
      offeredBalance: offeredBalance
        ? {
            total: offeredBalance.totalDays,
            used: offeredBalance.usedDays,
            pending: offeredBalance.pendingDays,
            remaining: offeredBalance.totalDays - offeredBalance.usedDays - offeredBalance.pendingDays,
          }
        : null,
    };
  });

  return NextResponse.json({
    year,
    employees: employeeSummary,
    leaveTypes,
    teamMembers: teamMembers.map((m) => ({
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
    })),
  });
}
