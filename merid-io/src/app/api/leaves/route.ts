import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { leaveRequestSchema } from "@/lib/validators";
import { notifyNewLeaveRequest } from "@/lib/notifications";
import { parseDateRangeParams } from "@/lib/date-utils";
import { logAudit, getIp } from "@/lib/audit";
import type { Prisma } from "@prisma/client";
// File uploads now handled by /api/upload (Vercel Blob)

// ─── GET: list user's leave requests (server-side filtering + pagination) ───

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));
  const skip = (page - 1) * limit;

  // Filters
  const statusFilter = searchParams.get("status"); // comma-separated
  const typeFilter = searchParams.get("type"); // leaveTypeConfigId
  const sortBy = searchParams.get("sortBy") ?? "createdAt";
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

  // Validate date params with Zod — return 400 on invalid input
  const dateRange = parseDateRangeParams(searchParams, "leaves");
  if (dateRange.error) {
    return NextResponse.json({ error: dateRange.error }, { status: 400 });
  }

  const where: Prisma.LeaveRequestWhereInput = { userId };

  if (statusFilter) {
    const statuses = statusFilter.split(",").filter(Boolean);
    if (statuses.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where.status = { in: statuses as any };
    }
  }

  if (typeFilter) {
    where.leaveTypeConfigId = typeFilter;
  }

  if (dateRange.from || dateRange.to) {
    where.startDate = {};
    if (dateRange.from) (where.startDate as Prisma.DateTimeFilter).gte = dateRange.from;
    if (dateRange.to) (where.startDate as Prisma.DateTimeFilter).lte = dateRange.to;
  }

  const orderBy: Prisma.LeaveRequestOrderByWithRelationInput = {};
  if (sortBy === "startDate" || sortBy === "createdAt" || sortBy === "totalDays" || sortBy === "status") {
    orderBy[sortBy] = sortOrder;
  } else {
    orderBy.createdAt = "desc";
  }

  const [items, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: {
        leaveTypeConfig: {
          select: { id: true, code: true, label_fr: true, label_en: true, color: true },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return NextResponse.json({
    items: items.map((r) => ({
      id: r.id,
      startDate: r.startDate,
      endDate: r.endDate,
      startHalfDay: r.startHalfDay,
      endHalfDay: r.endHalfDay,
      totalDays: r.totalDays,
      status: r.status,
      reason: r.reason,
      createdAt: r.createdAt,
      leaveType: r.leaveTypeConfig,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// ─── POST: create leave request ───

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

  // Get user + office + team
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      officeId: true,
      teamId: true,
      hireDate: true,
      office: {
        select: {
          probationMonths: true,
          workingDays: true,
        },
      },
      team: {
        select: {
          id: true,
          managerId: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // Check probation only if trialModeEnabled is true at company level
  const company = await prisma.company.findFirst({
    select: { trialModeEnabled: true },
  });
  const trialModeEnabled = company?.trialModeEnabled ?? false;

  if (trialModeEnabled) {
    const now = new Date();
    const probationEnd = new Date(user.hireDate);
    probationEnd.setMonth(probationEnd.getMonth() + user.office.probationMonths);
    if (now < probationEnd) {
      // Allow drafts even during probation, only block submit
      if (action === "submit") {
        return NextResponse.json(
          { error: "Les demandes de congé ne peuvent pas être soumises pendant la période d'essai. Vous pouvez enregistrer un brouillon." },
          { status: 403 }
        );
      }
    }
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

  // Check balance if this leave type deducts from balance (exceptional leaves are exempt)
  if (leaveType.deductsFromBalance && leaveType.balanceType && leaveType.code !== "EXCEPTIONAL") {
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

  // Attachments are now pre-uploaded via /api/upload (Vercel Blob)
  // The form sends comma-separated URLs in the "attachmentUrls" field
  const attachmentUrlsRaw = formData.get("attachmentUrls") as string | null;
  const attachmentUrls: string[] = attachmentUrlsRaw
    ? attachmentUrlsRaw.split(",").map((u) => u.trim()).filter(Boolean)
    : [];

  const isSubmit = action === "submit";
  const status: "DRAFT" | "PENDING_MANAGER" = isSubmit ? "PENDING_MANAGER" : "DRAFT";

  // If submitting, resolve workflow by team
  let workflowConfig: { id: string; mode: "SEQUENTIAL" | "PARALLEL"; steps: { id: string; stepOrder: number; stepType: "MANAGER" | "HR"; isRequired: boolean }[] } | null = null;
  if (isSubmit && user.teamId) {
    const workflows = await prisma.workflowConfig.findMany({
      where: {
        isActive: true,
        teams: { some: { id: user.teamId } },
      },
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
      },
    });

    if (workflows.length === 0) {
      return NextResponse.json(
        { error: "Aucun workflow actif configuré pour votre équipe. Contactez votre administrateur." },
        { status: 400 }
      );
    }

    // Use the first active workflow
    workflowConfig = workflows[0];
  } else if (isSubmit && !user.teamId) {
    // Fallback: user has no team, try to find workflow by office (backward compat)
    const workflows = await prisma.workflowConfig.findMany({
      where: {
        isActive: true,
        officeId: user.officeId,
      },
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
      },
    });

    if (workflows.length > 0) {
      workflowConfig = workflows[0];
    }
    // If no workflow found and no team, still allow submission without approval steps
  }

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

  // Create approval steps based on workflow
  const approvalStepsData: { leaveRequestId: string; approverId: string; stepType: "MANAGER" | "HR"; stepOrder: number }[] = [];
  if (isSubmit && workflowConfig && workflowConfig.steps.length > 0) {
    for (const step of workflowConfig.steps) {
      if (step.stepType === "MANAGER") {
        const managerId = user.team?.managerId;
        if (managerId) {
          approvalStepsData.push({
            leaveRequestId: leaveRequest.id,
            approverId: managerId,
            stepType: step.stepType,
            stepOrder: step.stepOrder,
          });
        }
      } else if (step.stepType === "HR") {
        const hrUser = await prisma.user.findFirst({
          where: { roles: { has: "HR" }, isActive: true },
          select: { id: true },
        });
        if (hrUser) {
          approvalStepsData.push({
            leaveRequestId: leaveRequest.id,
            approverId: hrUser.id,
            stepType: step.stepType,
            stepOrder: step.stepOrder,
          });
        }
      }
    }

    if (approvalStepsData.length > 0) {
      await prisma.approvalStep.createMany({ data: approvalStepsData });
    }
  }

  // Send notifications to approvers based on workflow mode
  if (isSubmit && approvalStepsData.length > 0 && workflowConfig) {
    const employeeName = `${user.firstName} ${user.lastName}`;
    const notifyParams = {
      leaveRequestId: leaveRequest.id,
      employeeName,
      leaveType: leaveType.label_fr,
      startDate: data.startDate,
      endDate: data.endDate,
      totalDays,
    };

    if (workflowConfig.mode === "PARALLEL") {
      // PARALLEL mode → notify ALL approvers simultaneously
      const allApproverIds = approvalStepsData.map((s) => s.approverId);
      const uniqueApproverIds = [...new Set(allApproverIds)];
      notifyNewLeaveRequest(uniqueApproverIds, notifyParams).catch((err) =>
        console.error("[leaves] Error sending parallel notifications:", err)
      );
    } else {
      // SEQUENTIAL mode → notify only first step approver
      const firstStepOrder = Math.min(...approvalStepsData.map((s) => s.stepOrder));
      const firstStepApprovers = approvalStepsData
        .filter((s) => s.stepOrder === firstStepOrder)
        .map((s) => s.approverId);
      const uniqueFirstApprovers = [...new Set(firstStepApprovers)];
      notifyNewLeaveRequest(uniqueFirstApprovers, notifyParams).catch((err) =>
        console.error("[leaves] Error sending sequential notifications:", err)
      );
    }
  }

  // If submitted (not draft), update pending days on balance (exceptional leaves are exempt)
  if (status === "PENDING_MANAGER" && leaveType.deductsFromBalance && leaveType.balanceType && leaveType.code !== "EXCEPTIONAL") {
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

  logAudit(userId, "CREATE_LEAVE", {
    entityType: "LeaveRequest",
    entityId: leaveRequest.id,
    ip: getIp(request.headers),
    newValue: { status, totalDays, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
  });

  return NextResponse.json({ id: leaveRequest.id, status }, { status: 201 });
}
