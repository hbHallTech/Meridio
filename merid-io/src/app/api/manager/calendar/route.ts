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
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Find teams managed by this user
  const managedTeams = await prisma.team.findMany({
    where: { managerId: session.user.id },
    select: { id: true, name: true },
  });
  const teamIds = managedTeams.map((t) => t.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    user: { teamId: { in: teamIds } },
    status: { in: ["APPROVED", "PENDING_MANAGER", "PENDING_HR"] },
  };

  if (from) where.endDate = { gte: new Date(from) };
  if (to) {
    where.startDate = { ...(where.startDate ?? {}), lte: new Date(to + "T23:59:59") };
  }

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

  console.log(`Manager calendar : ${items.length} demandes fetchées`);

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
}
