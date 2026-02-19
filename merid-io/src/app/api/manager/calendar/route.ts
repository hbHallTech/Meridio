import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDateRangeParams } from "@/lib/date-utils";
import { requireRoles } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  const session = await auth();
  const denied = requireRoles(session?.user, "MANAGER", "ADMIN");
  if (denied) return denied;

  const { searchParams } = request.nextUrl;

  // Validate date params with Zod — return 400 on invalid input
  const dateRange = parseDateRangeParams(searchParams, "manager/calendar");
  if (dateRange.error) {
    return NextResponse.json({ error: dateRange.error }, { status: 400 });
  }
  const { from, to } = dateRange;

  // Find teams managed by this user
  const managedTeams = await prisma.team.findMany({
    where: { managerId: session!.user.id },
    select: { id: true, name: true },
  });
  const teamIds = managedTeams.map((t) => t.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    user: { teamId: { in: teamIds } },
    status: { in: ["APPROVED", "PENDING_MANAGER", "PENDING_HR"] },
  };

  if (from) where.endDate = { gte: from };
  if (to) where.startDate = { ...(where.startDate ?? {}), lte: to };

  try {
    const items = await prisma.leaveRequest.findMany({
      where,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        totalDays: true,
        status: true,
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        leaveTypeConfig: {
          select: { code: true, label_fr: true, label_en: true, color: true },
        },
      },
    });

    console.log(`[manager/calendar] Fetched ${items.length} leave requests`);

    const events = items.map((item) => ({
      id: item.id,
      title: `${item.user.firstName} ${item.user.lastName}`,
      start: item.startDate,
      end: item.endDate,
      color: item.leaveTypeConfig.color,
      userId: item.user.id,
      leaveType: item.leaveTypeConfig.code,
      leaveTypeLabel_fr: item.leaveTypeConfig.label_fr,
      leaveTypeLabel_en: item.leaveTypeConfig.label_en,
      status: item.status,
      totalDays: item.totalDays,
    }));

    return NextResponse.json({ events, teams: managedTeams });
  } catch (error) {
    console.error("[manager/calendar] Query error:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement du calendrier" },
      { status: 500 }
    );
  }
}
