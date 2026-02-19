import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDateRangeParams } from "@/lib/date-utils";
import { requireRoles } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  const session = await auth();
  const denied = requireRoles(session?.user, "HR", "ADMIN");
  if (denied) return denied;

  const { searchParams } = request.nextUrl;
  const officeId = searchParams.get("officeId") || undefined;
  const teamId = searchParams.get("teamId") || undefined;
  const typeId = searchParams.get("typeId") || undefined;
  const status = searchParams.get("status") || undefined;

  // Validate date params with Zod — return 400 on invalid input
  const dateRange = parseDateRangeParams(searchParams, "hr/reports");
  if (dateRange.error) {
    return NextResponse.json({ error: dateRange.error }, { status: 400 });
  }
  const { from, to } = dateRange;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (status) {
    const statuses = status.split(",");
    where.status = { in: statuses };
  }
  if (typeId) where.leaveTypeConfigId = typeId;
  if (from) where.startDate = { ...(where.startDate ?? {}), gte: from };
  if (to) where.endDate = { ...(where.endDate ?? {}), lte: to };

  if (officeId || teamId) {
    where.user = {};
    if (officeId) where.user.officeId = officeId;
    if (teamId) where.user.teamId = teamId;
  }

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
            office: { select: { name: true } },
            team: { select: { name: true } },
          },
        },
        leaveTypeConfig: {
          select: { code: true, label_fr: true, label_en: true, color: true },
        },
      },
    });

    // Filter options
    const [offices, teams, leaveTypes] = await Promise.all([
      prisma.office.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.team.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.leaveTypeConfig.findMany({
        where: { isActive: true },
        select: { id: true, label_fr: true, label_en: true },
        distinct: ["code"],
      }),
    ]);

    // Summary stats
    const totalDays = items.reduce((s, i) => s + i.totalDays, 0);
    const approvedCount = items.filter((i) => i.status === "APPROVED").length;

    console.log(`[hr/reports] Fetched ${items.length} leave requests`);

    return NextResponse.json({
      items,
      filters: { offices, teams, leaveTypes },
      summary: { totalRequests: items.length, totalDays, approvedCount },
    });
  } catch (error) {
    console.error("[hr/reports] Query error:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des rapports" },
      { status: 500 }
    );
  }
}
