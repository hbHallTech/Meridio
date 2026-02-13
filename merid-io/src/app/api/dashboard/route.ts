import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();
  const currentYear = now.getFullYear();

  // Fetch user with office (for probation check)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      hireDate: true,
      officeId: true,
      office: { select: { probationMonths: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // Probation check
  const probationEnd = new Date(user.hireDate);
  probationEnd.setMonth(probationEnd.getMonth() + user.office.probationMonths);
  const isOnProbation = now < probationEnd;

  // Balances for current year
  const balances = await prisma.leaveBalance.findMany({
    where: { userId, year: currentYear },
  });

  const annualBalance = balances.find((b) => b.balanceType === "ANNUAL");
  const offeredBalance = balances.find((b) => b.balanceType === "OFFERED");

  // Pending requests count (user's own)
  const pendingCount = await prisma.leaveRequest.count({
    where: {
      userId,
      status: { in: ["PENDING_MANAGER", "PENDING_HR"] },
    },
  });

  // Upcoming approved leaves
  const upcomingLeaves = await prisma.leaveRequest.findMany({
    where: {
      userId,
      status: "APPROVED",
      startDate: { gte: now },
    },
    include: {
      leaveTypeConfig: {
        select: { code: true, label_fr: true, label_en: true, color: true },
      },
    },
    orderBy: { startDate: "asc" },
    take: 3,
  });

  // Leave distribution by type (approved, current year)
  const startOfYear = new Date(currentYear, 0, 1);
  const endOfYear = new Date(currentYear, 11, 31);

  const leavesByType = await prisma.leaveRequest.groupBy({
    by: ["leaveTypeConfigId"],
    where: {
      userId,
      status: "APPROVED",
      startDate: { gte: startOfYear, lte: endOfYear },
    },
    _sum: { totalDays: true },
  });

  // Get leave type labels for the chart
  const leaveTypeIds = leavesByType.map((l) => l.leaveTypeConfigId);
  const leaveTypes = await prisma.leaveTypeConfig.findMany({
    where: { id: { in: leaveTypeIds } },
    select: { id: true, code: true, label_fr: true, label_en: true, color: true },
  });

  const chartData = leavesByType.map((entry) => {
    const lt = leaveTypes.find((t) => t.id === entry.leaveTypeConfigId);
    return {
      name_fr: lt?.label_fr ?? "Autre",
      name_en: lt?.label_en ?? "Other",
      code: lt?.code ?? "UNKNOWN",
      color: lt?.color ?? "#94A3B8",
      value: entry._sum.totalDays ?? 0,
    };
  });

  // Recent requests (5 most recent)
  const recentRequests = await prisma.leaveRequest.findMany({
    where: { userId },
    include: {
      leaveTypeConfig: {
        select: { code: true, label_fr: true, label_en: true, color: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Next 3 public holidays for user's office
  const upcomingHolidays = await prisma.publicHoliday.findMany({
    where: {
      officeId: user.officeId,
      date: { gte: now },
    },
    orderBy: { date: "asc" },
    take: 3,
  });

  return NextResponse.json({
    balances: {
      annual: annualBalance
        ? {
            total: annualBalance.totalDays,
            used: annualBalance.usedDays,
            pending: annualBalance.pendingDays,
            carriedOver: annualBalance.carriedOverDays,
            remaining:
              annualBalance.totalDays +
              annualBalance.carriedOverDays -
              annualBalance.usedDays -
              annualBalance.pendingDays,
          }
        : null,
      offered: offeredBalance
        ? {
            total: offeredBalance.totalDays,
            used: offeredBalance.usedDays,
            pending: offeredBalance.pendingDays,
            remaining:
              offeredBalance.totalDays -
              offeredBalance.usedDays -
              offeredBalance.pendingDays,
          }
        : null,
    },
    pendingCount,
    upcomingLeaves: upcomingLeaves.map((l) => ({
      id: l.id,
      startDate: l.startDate,
      endDate: l.endDate,
      totalDays: l.totalDays,
      leaveType: l.leaveTypeConfig,
    })),
    chartData,
    recentRequests: recentRequests.map((r) => ({
      id: r.id,
      startDate: r.startDate,
      endDate: r.endDate,
      totalDays: r.totalDays,
      status: r.status,
      createdAt: r.createdAt,
      leaveType: r.leaveTypeConfig,
    })),
    upcomingHolidays: upcomingHolidays.map((h) => ({
      id: h.id,
      date: h.date,
      name_fr: h.name_fr,
      name_en: h.name_en,
    })),
    probation: isOnProbation
      ? { endDate: probationEnd.toISOString() }
      : null,
  });
}
