import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DAY_MAP: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();
  const { startDate, endDate, startHalfDay, endHalfDay } = body;

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Dates requises" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      officeId: true,
      office: { select: { workingDays: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const workingDayNumbers = new Set(
    user.office.workingDays.map((d) => DAY_MAP[d] ?? -1)
  );

  const holidays = await prisma.publicHoliday.findMany({
    where: { officeId: user.officeId },
    select: { date: true },
  });
  const holidaySet = new Set(
    holidays.map((h) => h.date.toISOString().split("T")[0])
  );

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return NextResponse.json({ error: "Dates invalides" }, { status: 400 });
  }

  let totalDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split("T")[0];

    if (workingDayNumbers.has(dayOfWeek) && !holidaySet.has(dateStr)) {
      if (current.getTime() === start.getTime() && current.getTime() === end.getTime()) {
        // Same day
        if (startHalfDay === "MORNING" || startHalfDay === "AFTERNOON") {
          totalDays += 0.5;
        } else if (endHalfDay === "MORNING" || endHalfDay === "AFTERNOON") {
          totalDays += 0.5;
        } else {
          totalDays += 1;
        }
      } else if (current.getTime() === start.getTime()) {
        totalDays += startHalfDay === "AFTERNOON" ? 0.5 : 1;
      } else if (current.getTime() === end.getTime()) {
        totalDays += endHalfDay === "MORNING" ? 0.5 : 1;
      } else {
        totalDays += 1;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return NextResponse.json({ totalDays });
}
