import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Parse a date string safely. Returns a valid Date or null.
 * Handles both ISO strings (2026-02-01T00:00:00.000Z) and date-only (2026-02-01).
 */
function safeParseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    console.error(`[manager/calendar] Invalid date param: "${value}"`);
    return null;
  }
  return d;
}

/**
 * For "to" date params, ensure we include the full end-of-day.
 * If the string is date-only (YYYY-MM-DD), set to 23:59:59.
 * If already an ISO datetime, use as-is (FullCalendar already sends correct range).
 */
function safeParseEndDateParam(value: string | null): Date | null {
  if (!value) return null;
  // If date-only format (no 'T'), append end-of-day time
  const raw = value.includes("T") ? value : `${value}T23:59:59.999Z`;
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    console.error(`[manager/calendar] Invalid end date param: "${value}"`);
    return null;
  }
  return d;
}

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
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const fromDate = safeParseDateParam(fromParam);
  const toDate = safeParseEndDateParam(toParam);

  // Log invalid date params for debugging
  if (fromParam && !fromDate) {
    console.error(`[manager/calendar] Skipping invalid 'from' param: "${fromParam}"`);
  }
  if (toParam && !toDate) {
    console.error(`[manager/calendar] Skipping invalid 'to' param: "${toParam}"`);
  }

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

  if (fromDate) where.endDate = { gte: fromDate };
  if (toDate) where.startDate = { ...(where.startDate ?? {}), lte: toDate };

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

  console.log(`[manager/calendar] ${items.length} leave requests fetched (from=${fromParam}, to=${toParam})`);

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
