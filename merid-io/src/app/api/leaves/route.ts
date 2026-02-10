import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { leaveRequestSchema } from "@/lib/validators";

const DAY_MAP: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

function calculateWorkingDays(
  start: Date,
  end: Date,
  startHalfDay: string,
  endHalfDay: string,
  workingDayNumbers: Set<number>,
  holidaySet: Set<string>
): number {
  let totalDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split("T")[0];

    if (workingDayNumbers.has(dayOfWeek) && !holidaySet.has(dateStr)) {
      if (current.getTime() === start.getTime() && current.getTime() === end.getTime()) {
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

  return totalDays;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = session.user.id;

  // Parse form data (supports file uploads)
  const formData = await request.formData();
  const body = {
    leaveTypeConfigId: formData.get("leaveTypeConfigId") as string,
    startDate: formData.get("startDate") as string,
    endDate: formData.get("endDate") as string,
    startHalfDay: formData.get("startHalfDay") as string,
    endHalfDay: formData.get("endHalfDay") as string,
    reason: (formData.get("reason") as string) || undefined,
    exceptionalReason: (formData.get("exceptionalReason") as string) || undefined,
  };
  const action = formData.get("action") as string; // "draft" or "submit"
  const attachments = formData.getAll("attachments") as File[];

  const parsed = leaveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);

  // Validate dates
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Dates invalides" }, { status: 400 });
  }
  if (endDate < startDate) {
    return NextResponse.json(
      { error: "La date de fin doit être après la date de début" },
      { status: 400 }
    );
  }

  // Get user + office
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      officeId: true,
      hireDate: true,
      office: {
        select: {
          probationMonths: true,
          workingDays: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // Check probation
  const now = new Date();
  const probationEnd = new Date(user.hireDate);
  probationEnd.setMonth(probationEnd.getMonth() + user.office.probationMonths);
  if (now < probationEnd) {
    return NextResponse.json(
      { error: "Les demandes de congé ne sont pas possibles pendant la période d'essai" },
      { status: 403 }
    );
  }

  // Get leave type config
  const leaveType = await prisma.leaveTypeConfig.findUnique({
    where: { id: data.leaveTypeConfigId },
  });
  if (!leaveType || leaveType.officeId !== user.officeId) {
    return NextResponse.json(
      { error: "Type de congé invalide" },
      { status: 400 }
    );
  }

  // Calculate working days server-side
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

  const totalDays = calculateWorkingDays(
    startDate,
    endDate,
    data.startHalfDay,
    data.endHalfDay,
    workingDayNumbers,
    holidaySet
  );

  if (totalDays <= 0) {
    return NextResponse.json(
      { error: "La période sélectionnée ne contient aucun jour ouvré" },
      { status: 400 }
    );
  }

  // Check balance if this leave type deducts from balance
  if (leaveType.deductsFromBalance && leaveType.balanceType) {
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_year_balanceType: {
          userId,
          year: startDate.getFullYear(),
          balanceType: leaveType.balanceType,
        },
      },
    });

    if (!balance) {
      return NextResponse.json(
        { error: "Aucun solde configuré pour ce type de congé" },
        { status: 400 }
      );
    }

    const remaining =
      balance.totalDays + balance.carriedOverDays - balance.usedDays - balance.pendingDays;
    if (totalDays > remaining) {
      return NextResponse.json(
        {
          error: `Solde insuffisant. Restant : ${remaining}j, demandé : ${totalDays}j`,
        },
        { status: 400 }
      );
    }
  }

  // Check overlap with existing non-cancelled requests
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      userId,
      status: { notIn: ["CANCELLED", "REFUSED"] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });

  if (overlapping) {
    return NextResponse.json(
      { error: "Cette période chevauche une demande existante" },
      { status: 409 }
    );
  }

  // Handle file uploads — store filenames (in production, use S3/cloud storage)
  const attachmentUrls: string[] = [];
  for (const file of attachments) {
    if (file.size > 0) {
      // For now, store as data URIs or file names — real impl would upload to storage
      attachmentUrls.push(file.name);
    }
  }

  const status = action === "submit" ? "PENDING_MANAGER" : "DRAFT";

  // Create leave request
  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      userId,
      leaveTypeConfigId: data.leaveTypeConfigId,
      startDate,
      endDate,
      startHalfDay: data.startHalfDay as "FULL_DAY" | "MORNING" | "AFTERNOON",
      endHalfDay: data.endHalfDay as "FULL_DAY" | "MORNING" | "AFTERNOON",
      totalDays,
      status,
      reason: data.reason || null,
      exceptionalReason: data.exceptionalReason || null,
      attachmentUrls,
    },
  });

  // If submitted (not draft), update pending days on balance
  if (status === "PENDING_MANAGER" && leaveType.deductsFromBalance && leaveType.balanceType) {
    await prisma.leaveBalance.update({
      where: {
        userId_year_balanceType: {
          userId,
          year: startDate.getFullYear(),
          balanceType: leaveType.balanceType,
        },
      },
      data: {
        pendingDays: { increment: totalDays },
      },
    });
  }

  return NextResponse.json({ id: leaveRequest.id, status }, { status: 201 });
}
