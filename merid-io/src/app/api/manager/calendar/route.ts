import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "manager:access") && !hasPermission(userRoles, "hr:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "Paramètres start et end requis" }, { status: 400 });
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  // Find team members (current user is manager of a team)
  const managedTeam = await prisma.team.findUnique({
    where: { managerId: session.user.id },
    include: {
      members: {
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  const teamMemberIds = managedTeam
    ? [session.user.id, ...managedTeam.members.map((m) => m.id)]
    : [session.user.id];

  // Fetch leave requests for the team in the date range
  const leaveRequests = await prisma.leaveRequest.findMany({
    where: {
      userId: { in: teamMemberIds },
      status: { in: ["APPROVED", "PENDING_MANAGER", "PENDING_HR"] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true },
      },
      leaveTypeConfig: {
        select: { code: true, label_fr: true, label_en: true, color: true },
      },
    },
    orderBy: { startDate: "asc" },
  });

  // Fetch public holidays for the office
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { officeId: true },
  });

  const holidays = user
    ? await prisma.publicHoliday.findMany({
        where: {
          officeId: user.officeId,
          date: { gte: startDate, lte: endDate },
        },
        select: { date: true, name_fr: true, name_en: true },
      })
    : [];

  // Format events for FullCalendar
  const events = leaveRequests.map((lr) => ({
    id: lr.id,
    title: `${lr.user.firstName} ${lr.user.lastName}`,
    start: lr.startDate.toISOString().split("T")[0],
    end: new Date(lr.endDate.getTime() + 86400000).toISOString().split("T")[0], // FullCalendar end is exclusive
    backgroundColor: lr.status === "APPROVED" ? lr.leaveTypeConfig.color : `${lr.leaveTypeConfig.color}80`,
    borderColor: lr.leaveTypeConfig.color,
    extendedProps: {
      employeeName: `${lr.user.firstName} ${lr.user.lastName}`,
      leaveType: lr.leaveTypeConfig,
      status: lr.status,
      totalDays: lr.totalDays,
      startHalfDay: lr.startHalfDay,
      endHalfDay: lr.endHalfDay,
    },
  }));

  const holidayEvents = holidays.map((h, idx) => ({
    id: `holiday-${idx}`,
    title: h.name_fr,
    start: h.date.toISOString().split("T")[0],
    end: h.date.toISOString().split("T")[0],
    backgroundColor: "#F3F4F6",
    borderColor: "#9CA3AF",
    textColor: "#6B7280",
    display: "background",
    extendedProps: {
      isHoliday: true,
      name_fr: h.name_fr,
      name_en: h.name_en,
    },
  }));

  // Get unique leave types for legend
  const leaveTypes = Array.from(
    new Map(
      leaveRequests.map((lr) => [
        lr.leaveTypeConfig.code,
        {
          code: lr.leaveTypeConfig.code,
          label_fr: lr.leaveTypeConfig.label_fr,
          label_en: lr.leaveTypeConfig.label_en,
          color: lr.leaveTypeConfig.color,
        },
      ])
    ).values()
  );

  // Also get all configured leave types for the office
  const allLeaveTypes = user
    ? await prisma.leaveTypeConfig.findMany({
        where: { officeId: user.officeId, isActive: true },
        select: { code: true, label_fr: true, label_en: true, color: true },
      })
    : [];

  return NextResponse.json({
    events: [...events, ...holidayEvents],
    leaveTypes: allLeaveTypes,
    teamMembers: managedTeam?.members ?? [],
  });
}
