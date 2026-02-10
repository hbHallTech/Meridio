import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      hireDate: true,
      officeId: true,
      office: {
        select: {
          probationMonths: true,
          minNoticeDays: true,
          sickLeaveJustifFromDay: true,
          workingDays: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const now = new Date();
  const probationEnd = new Date(user.hireDate);
  probationEnd.setMonth(probationEnd.getMonth() + user.office.probationMonths);
  const isOnProbation = now < probationEnd;

  const currentYear = now.getFullYear();

  // Fetch in parallel: leave types, balances, holidays, exceptional rules
  const [leaveTypes, balances, publicHolidays, exceptionalRules] =
    await Promise.all([
      prisma.leaveTypeConfig.findMany({
        where: { officeId: user.officeId, isActive: true },
        orderBy: { code: "asc" },
      }),
      prisma.leaveBalance.findMany({
        where: { userId, year: currentYear },
      }),
      prisma.publicHoliday.findMany({
        where: { officeId: user.officeId },
        select: { date: true },
      }),
      prisma.exceptionalLeaveRule.findMany({
        where: { officeId: user.officeId, isActive: true },
        orderBy: { reason_fr: "asc" },
      }),
    ]);

  const balancesMap: Record<
    string,
    { total: number; used: number; pending: number; remaining: number }
  > = {};
  for (const b of balances) {
    balancesMap[b.balanceType] = {
      total: b.totalDays + b.carriedOverDays,
      used: b.usedDays,
      pending: b.pendingDays,
      remaining: b.totalDays + b.carriedOverDays - b.usedDays - b.pendingDays,
    };
  }

  return NextResponse.json({
    leaveTypes: leaveTypes.map((lt) => ({
      id: lt.id,
      code: lt.code,
      label_fr: lt.label_fr,
      label_en: lt.label_en,
      color: lt.color,
      requiresAttachment: lt.requiresAttachment,
      attachmentFromDay: lt.attachmentFromDay,
      deductsFromBalance: lt.deductsFromBalance,
      balanceType: lt.balanceType,
    })),
    balances: balancesMap,
    exceptionalRules: exceptionalRules.map((r) => ({
      id: r.id,
      reason_fr: r.reason_fr,
      reason_en: r.reason_en,
      maxDays: r.maxDays,
    })),
    publicHolidays: publicHolidays.map((h) => h.date),
    officeConfig: {
      minNoticeDays: user.office.minNoticeDays,
      sickLeaveJustifFromDay: user.office.sickLeaveJustifFromDay,
      workingDays: user.office.workingDays,
    },
    probation: isOnProbation
      ? { endDate: probationEnd.toISOString() }
      : null,
  });
}
