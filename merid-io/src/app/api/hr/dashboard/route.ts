import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "hr:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);
  const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

  // ─── KPIs ───

  // Current absences (approved leaves that overlap with today)
  const currentAbsences = await prisma.leaveRequest.count({
    where: {
      status: "APPROVED",
      startDate: { lte: now },
      endDate: { gte: now },
    },
  });

  // Pending HR requests
  const pendingHR = await prisma.leaveRequest.count({
    where: { status: "PENDING_HR" },
  });

  // Pending Manager requests
  const pendingManager = await prisma.leaveRequest.count({
    where: { status: "PENDING_MANAGER" },
  });

  // Total active employees
  const totalEmployees = await prisma.user.count({
    where: { isActive: true },
  });

  // Absenteeism rate by office
  const offices = await prisma.office.findMany({
    select: { id: true, name: true, city: true },
  });

  const absenteeismByOffice = await Promise.all(
    offices.map(async (office) => {
      const officeEmployees = await prisma.user.count({
        where: { officeId: office.id, isActive: true },
      });
      const officeAbsent = await prisma.leaveRequest.count({
        where: {
          status: "APPROVED",
          startDate: { lte: now },
          endDate: { gte: now },
          user: { officeId: office.id },
        },
      });
      return {
        officeId: office.id,
        name: office.name,
        city: office.city,
        employees: officeEmployees,
        absent: officeAbsent,
        rate: officeEmployees > 0 ? Math.round((officeAbsent / officeEmployees) * 100) : 0,
      };
    })
  );

  // ─── Absences by month (line chart) ───

  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: endOfYear },
      endDate: { gte: startOfYear },
    },
    select: {
      startDate: true,
      totalDays: true,
    },
  });

  const byMonth = Array.from({ length: 12 }, (_, i) => ({
    month: i,
    days: 0,
  }));
  for (const lr of approvedLeaves) {
    const month = lr.startDate.getMonth();
    byMonth[month].days += lr.totalDays;
  }

  // ─── Absences by office (bar chart) ───

  const leavesByOffice = await prisma.leaveRequest.groupBy({
    by: ["userId"],
    where: {
      status: "APPROVED",
      startDate: { gte: startOfYear, lte: endOfYear },
    },
    _sum: { totalDays: true },
  });

  // Map userId → officeId
  const usersOffice = await prisma.user.findMany({
    where: { id: { in: leavesByOffice.map((l) => l.userId) } },
    select: { id: true, officeId: true },
  });
  const userOfficeMap = new Map(usersOffice.map((u) => [u.id, u.officeId]));

  const officeChartMap = new Map<string, number>();
  for (const entry of leavesByOffice) {
    const officeId = userOfficeMap.get(entry.userId);
    if (officeId) {
      officeChartMap.set(officeId, (officeChartMap.get(officeId) ?? 0) + (entry._sum.totalDays ?? 0));
    }
  }

  const byOffice = offices.map((o) => ({
    name: o.name,
    city: o.city,
    days: officeChartMap.get(o.id) ?? 0,
  }));

  // ─── Absences by type (pie chart) ───

  const leavesByType = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { gte: startOfYear, lte: endOfYear },
    },
    select: {
      totalDays: true,
      leaveTypeConfig: {
        select: { code: true, label_fr: true, label_en: true, color: true },
      },
    },
  });

  const typeMap = new Map<string, { label_fr: string; label_en: string; color: string; days: number }>();
  for (const lr of leavesByType) {
    const code = lr.leaveTypeConfig.code;
    const existing = typeMap.get(code);
    if (existing) {
      existing.days += lr.totalDays;
    } else {
      typeMap.set(code, {
        label_fr: lr.leaveTypeConfig.label_fr,
        label_en: lr.leaveTypeConfig.label_en,
        color: lr.leaveTypeConfig.color,
        days: lr.totalDays,
      });
    }
  }
  const byType = Array.from(typeMap.values());

  // ─── Average validation delay ───

  const decidedSteps = await prisma.approvalStep.findMany({
    where: {
      action: { not: null },
      decidedAt: { not: null },
      leaveRequest: {
        createdAt: { gte: startOfYear },
      },
    },
    select: {
      decidedAt: true,
      leaveRequest: { select: { createdAt: true } },
    },
  });

  let totalDelayHours = 0;
  for (const step of decidedSteps) {
    if (step.decidedAt) {
      totalDelayHours += (step.decidedAt.getTime() - step.leaveRequest.createdAt.getTime()) / (1000 * 60 * 60);
    }
  }
  const avgDelayHours = decidedSteps.length > 0 ? Math.round(totalDelayHours / decidedSteps.length) : 0;

  return NextResponse.json({
    kpis: {
      currentAbsences,
      pendingHR,
      pendingManager,
      totalEmployees,
      avgDelayHours,
    },
    absenteeismByOffice,
    charts: {
      byMonth,
      byOffice,
      byType,
    },
    year: currentYear,
  });
}
