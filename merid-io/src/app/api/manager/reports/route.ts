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
  const typeId = searchParams.get("typeId") || undefined;
  const status = searchParams.get("status") || undefined;
  const teamIdFilter = searchParams.get("teamId") || undefined;

  // Validate date params with Zod — return 400 on invalid input
  const dateRange = parseDateRangeParams(searchParams, "manager/reports");
  if (dateRange.error) {
    return NextResponse.json({ error: dateRange.error }, { status: 400 });
  }
  const { from, to } = dateRange;

  // Find teams managed by this user
  const managedTeams = await prisma.team.findMany({
    where: { managerId: session!.user.id },
    select: { id: true, name: true },
  });
  const teamIds = teamIdFilter
    ? managedTeams.filter((t) => t.id === teamIdFilter).map((t) => t.id)
    : managedTeams.map((t) => t.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    user: { teamId: { in: teamIds } },
  };

  if (status) {
    const statuses = status.split(",");
    where.status = { in: statuses };
  }
  if (typeId) where.leaveTypeConfigId = typeId;
  if (from) where.startDate = { gte: from };
  if (to) where.endDate = { ...(where.endDate ?? {}), lte: to };

  try {
    const items = await prisma.leaveRequest.findMany({
      where,
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        totalDays: true,
        status: true,
        reason: true,
        createdAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            team: { select: { name: true } },
          },
        },
        leaveTypeConfig: {
          select: { code: true, label_fr: true, label_en: true, color: true },
        },
      },
    });

    // Leave types for filter
    const leaveTypes = await prisma.leaveTypeConfig.findMany({
      where: { isActive: true },
      select: { id: true, label_fr: true, label_en: true },
      distinct: ["code"],
    });

    const totalDays = items.reduce((s, i) => s + i.totalDays, 0);
    const approvedCount = items.filter((i) => i.status === "APPROVED").length;

    // Build teams filter list from managed teams
    const teams = managedTeams.map((t) => ({ id: t.id, name: t.name }));

    console.log(`[manager/reports] Fetched ${items.length} leave requests`);

    return NextResponse.json({
      items,
      filters: { teams, leaveTypes },
      summary: { totalRequests: items.length, totalDays, approvedCount },
    });
  } catch (error) {
    console.error("[manager/reports] Query error:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des rapports" },
      { status: 500 }
    );
  }
}
