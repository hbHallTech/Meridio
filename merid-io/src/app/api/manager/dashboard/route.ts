import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { LeaveStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  const denied = requireRoles(session?.user, "MANAGER", "ADMIN");
  if (denied) return denied;

  const { searchParams } = request.nextUrl;
  const userIdFilter = searchParams.get("userId") || undefined;

  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);

  // Find teams managed by this user
  const managedTeams = await prisma.team.findMany({
    where: { managerId: session!.user.id },
    select: { id: true, name: true },
  });
  const teamIds = managedTeams.map((t) => t.id);

  // Get team members
  const members = await prisma.user.findMany({
    where: { teamId: { in: teamIds }, isActive: true },
    select: { id: true, firstName: true, lastName: true, teamId: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  // Validate userId filter belongs to managed teams
  if (userIdFilter && !members.some((m) => m.id === userIdFilter)) {
    return NextResponse.json({ error: "Utilisateur non trouvé dans vos équipes" }, { status: 400 });
  }

  // Scope: all team members or single user
  const userScope = userIdFilter ? { userId: userIdFilter } : { user: { teamId: { in: teamIds } } };

  // ── KPIs ──
  const [pendingApprovals, activeAbsences, approvedThisYear] = await Promise.all([
    prisma.leaveRequest.count({
      where: { ...userScope, status: LeaveStatus.PENDING_MANAGER },
    }),
    prisma.leaveRequest.count({
      where: {
        ...userScope,
        status: LeaveStatus.APPROVED,
        startDate: { lte: now },
        endDate: { gte: now },
      },
    }),
    prisma.leaveRequest.aggregate({
      _sum: { totalDays: true },
      where: {
        ...userScope,
        status: LeaveStatus.APPROVED,
        startDate: { gte: startOfYear, lte: endOfYear },
      },
    }),
  ]);

  const teamMemberCount = userIdFilter ? 1 : members.length;
  const approvedDays = approvedThisYear._sum.totalDays ?? 0;
  const absenteeismRate = teamMemberCount > 0
    ? Math.round((approvedDays / (teamMemberCount * 220)) * 100 * 10) / 10
    : 0;

  // ── Absences by month (line chart) ──
  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      ...userScope,
      status: LeaveStatus.APPROVED,
      startDate: { gte: startOfYear, lte: endOfYear },
    },
    select: { startDate: true, totalDays: true },
  });

  const byMonth = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    label_fr: new Date(year, i).toLocaleDateString("fr-FR", { month: "short" }),
    label_en: new Date(year, i).toLocaleDateString("en-GB", { month: "short" }),
    days: 0,
  }));

  for (const leave of approvedLeaves) {
    const m = leave.startDate.getMonth();
    byMonth[m].days += leave.totalDays;
  }

  // ── Absences by type (pie chart) ──
  const leavesByType = await prisma.leaveRequest.groupBy({
    by: ["leaveTypeConfigId"],
    _sum: { totalDays: true },
    where: {
      ...userScope,
      status: LeaveStatus.APPROVED,
      startDate: { gte: startOfYear, lte: endOfYear },
    },
  });

  const leaveTypeConfigs = leavesByType.length > 0
    ? await prisma.leaveTypeConfig.findMany({
        where: { id: { in: leavesByType.map((l) => l.leaveTypeConfigId) } },
        select: { id: true, label_fr: true, label_en: true, color: true },
      })
    : [];

  const typeMap = Object.fromEntries(leaveTypeConfigs.map((c) => [c.id, c]));
  const byType = leavesByType
    .map((l) => {
      const config = typeMap[l.leaveTypeConfigId];
      return {
        name_fr: config?.label_fr ?? "Inconnu",
        name_en: config?.label_en ?? "Unknown",
        color: config?.color ?? "#6B7280",
        value: l._sum.totalDays ?? 0,
      };
    })
    .filter((t) => t.value > 0)
    .sort((a, b) => b.value - a.value);

  // ── Leave balances (only when a specific user is selected) ──
  let balances: { balanceType: string; totalDays: number; usedDays: number; pendingDays: number }[] = [];
  if (userIdFilter) {
    balances = await prisma.leaveBalance.findMany({
      where: { userId: userIdFilter, year },
      select: { balanceType: true, totalDays: true, usedDays: true, pendingDays: true },
    });
  }

  return NextResponse.json({
    kpis: {
      pendingApprovals,
      activeAbsences,
      teamMembers: teamMemberCount,
      approvedDaysThisYear: approvedDays,
      absenteeismRate,
    },
    byMonth,
    byType,
    balances,
    members: members.map((m) => ({
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
    })),
  });
}
