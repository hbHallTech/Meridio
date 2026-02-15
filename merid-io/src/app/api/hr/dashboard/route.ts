import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeaveStatus } from "@prisma/client";

export async function GET() {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("HR") && !roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);

  // ── KPIs ──
  const [pendingHR, activeAbsences, totalEmployees] = await Promise.all([
    prisma.leaveRequest.count({ where: { status: LeaveStatus.PENDING_HR } }),
    prisma.leaveRequest.count({
      where: {
        status: LeaveStatus.APPROVED,
        startDate: { lte: now },
        endDate: { gte: now },
      },
    }),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  // Approved days this year
  const approvedThisYear = await prisma.leaveRequest.aggregate({
    _sum: { totalDays: true },
    where: {
      status: LeaveStatus.APPROVED,
      startDate: { gte: startOfYear, lte: endOfYear },
    },
  });

  // ── Absences by month (line chart) ──
  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
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

  // ── Absences by office (bar chart) ──
  const offices = await prisma.office.findMany({
    select: { id: true, name: true, _count: { select: { users: true } } },
  });

  const leavesByOffice = await prisma.leaveRequest.findMany({
    where: {
      status: LeaveStatus.APPROVED,
      startDate: { gte: startOfYear, lte: endOfYear },
    },
    select: {
      totalDays: true,
      user: { select: { officeId: true } },
    },
  });

  const officeMap: Record<string, number> = {};
  for (const l of leavesByOffice) {
    if (l.user.officeId) {
      officeMap[l.user.officeId] = (officeMap[l.user.officeId] ?? 0) + l.totalDays;
    }
  }

  const byOffice = offices.map((o) => ({
    name: o.name,
    days: officeMap[o.id] ?? 0,
    employees: o._count.users,
    rate: o._count.users > 0 ? Math.round(((officeMap[o.id] ?? 0) / (o._count.users * 220)) * 100 * 10) / 10 : 0,
  }));

  // ── Absences by type (pie chart) ──
  const leavesByType = await prisma.leaveRequest.groupBy({
    by: ["leaveTypeConfigId"],
    _sum: { totalDays: true },
    where: {
      status: LeaveStatus.APPROVED,
      startDate: { gte: startOfYear, lte: endOfYear },
    },
  });

  const leaveTypeConfigs = await prisma.leaveTypeConfig.findMany({
    where: { id: { in: leavesByType.map((l) => l.leaveTypeConfigId) } },
    select: { id: true, label_fr: true, label_en: true, color: true },
  });

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

  return NextResponse.json({
    kpis: {
      pendingHR,
      activeAbsences,
      totalEmployees,
      approvedDaysThisYear: approvedThisYear._sum.totalDays ?? 0,
      absenteeismRate: totalEmployees > 0
        ? Math.round(((approvedThisYear._sum.totalDays ?? 0) / (totalEmployees * 220)) * 100 * 10) / 10
        : 0,
    },
    byMonth,
    byOffice,
    byType,
  });
}
