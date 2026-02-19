import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];
  if (!roles.includes("MANAGER") && !roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const typeId = searchParams.get("typeId") || undefined;
  const status = searchParams.get("status") || undefined;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const teamIdFilter = searchParams.get("teamId") || undefined;

  // Find teams managed by this user
  const managedTeams = await prisma.team.findMany({
    where: { managerId: session.user.id },
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
  if (from) where.startDate = { gte: new Date(from) };
  if (to) where.endDate = { ...(where.endDate ?? {}), lte: new Date(to + "T23:59:59") };

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

  return NextResponse.json({
    items,
    filters: { teams, leaveTypes },
    summary: { totalRequests: items.length, totalDays, approvedCount },
  });
}
