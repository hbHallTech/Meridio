import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { leaveRequestSchema } from "@/lib/validators";
import { requireOwnerOfLeave } from "@/lib/rbac";
import { createAuditLog } from "@/lib/notifications";
import { getRequestIp } from "@/lib/rate-limit";

// ─── GET: leave request detail ───

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      leaveTypeConfig: {
        select: {
          id: true,
          code: true,
          label_fr: true,
          label_en: true,
          color: true,
          requiresAttachment: true,
        },
      },
      approvalSteps: {
        include: {
          approver: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { stepOrder: "asc" },
      },
      user: {
        select: { id: true, firstName: true, lastName: true, teamId: true },
      },
    },
  });

  if (!leaveRequest) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }

  // Access control: owner, managers of the user's team, HR, Admin, or assigned approvers
  const isOwner = leaveRequest.userId === session.user.id;
  const userRoles = session.user.roles ?? [];
  const isAdmin = userRoles.includes("ADMIN");
  const isHR = userRoles.includes("HR");
  const isAssignedApprover = leaveRequest.approvalSteps.some(
    (step) => step.approver.id === session.user.id
  );

  let isTeamManager = false;
  if (userRoles.includes("MANAGER") && !isOwner && leaveRequest.user.teamId) {
    const team = await prisma.team.findUnique({
      where: { id: leaveRequest.user.teamId },
      select: { managerId: true },
    });
    isTeamManager = team?.managerId === session.user.id;
  }

  if (!isOwner && !isAdmin && !isHR && !isTeamManager && !isAssignedApprover) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  return NextResponse.json({
    id: leaveRequest.id,
    startDate: leaveRequest.startDate,
    endDate: leaveRequest.endDate,
    startHalfDay: leaveRequest.startHalfDay,
    endHalfDay: leaveRequest.endHalfDay,
    totalDays: leaveRequest.totalDays,
    status: leaveRequest.status,
    reason: leaveRequest.reason,
    exceptionalReason: leaveRequest.exceptionalReason,
    attachmentUrls: leaveRequest.attachmentUrls,
    isCompanyClosure: leaveRequest.isCompanyClosure,
    createdAt: leaveRequest.createdAt,
    updatedAt: leaveRequest.updatedAt,
    leaveType: leaveRequest.leaveTypeConfig,
    user: leaveRequest.user,
    approvalSteps: leaveRequest.approvalSteps.map((step) => ({
      id: step.id,
      stepType: step.stepType,
      stepOrder: step.stepOrder,
      action: step.action,
      comment: step.comment,
      decidedAt: step.decidedAt,
      createdAt: step.createdAt,
      approver: step.approver,
    })),
  });
}

// ─── PATCH: actions on a leave request (cancel, submit, etc.) ───

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const action = body.action as string;

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      leaveTypeConfig: true,
    },
  });

  if (!leaveRequest) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }

  if (leaveRequest.userId !== session.user.id) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  switch (action) {
    case "submit": {
      // Can only submit DRAFT or RETURNED requests
      if (leaveRequest.status !== "DRAFT" && leaveRequest.status !== "RETURNED") {
        return NextResponse.json(
          { error: "Seuls les brouillons ou demandes renvoyées peuvent être soumis" },
          { status: 400 }
        );
      }

      // Get user's team info for workflow resolution
      const submitter = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          officeId: true,
          teamId: true,
          team: { select: { id: true, managerId: true } },
        },
      });

      // Resolve workflow by team (or fallback to office)
      let workflowSteps: { stepOrder: number; stepType: "MANAGER" | "HR"; isRequired: boolean }[] = [];
      if (submitter?.teamId) {
        const wf = await prisma.workflowConfig.findFirst({
          where: { isActive: true, teams: { some: { id: submitter.teamId } } },
          include: { steps: { orderBy: { stepOrder: "asc" } } },
        });
        if (wf) workflowSteps = wf.steps;
      } else if (submitter?.officeId) {
        const wf = await prisma.workflowConfig.findFirst({
          where: { isActive: true, officeId: submitter.officeId },
          include: { steps: { orderBy: { stepOrder: "asc" } } },
        });
        if (wf) workflowSteps = wf.steps;
      }

      // Delete old approval steps if resubmitting a RETURNED request
      if (leaveRequest.status === "RETURNED") {
        await prisma.approvalStep.deleteMany({
          where: { leaveRequestId: id },
        });
      }

      await prisma.leaveRequest.update({
        where: { id },
        data: { status: "PENDING_MANAGER" },
      });

      // Create approval steps from workflow
      if (workflowSteps.length > 0 && submitter) {
        const approvalStepsData: { leaveRequestId: string; approverId: string; stepType: "MANAGER" | "HR"; stepOrder: number }[] = [];

        for (const step of workflowSteps) {
          if (step.stepType === "MANAGER" && submitter.team?.managerId) {
            approvalStepsData.push({
              leaveRequestId: id,
              approverId: submitter.team.managerId,
              stepType: step.stepType,
              stepOrder: step.stepOrder,
            });
          } else if (step.stepType === "HR") {
            const hrUser = await prisma.user.findFirst({
              where: { roles: { has: "HR" }, isActive: true },
              select: { id: true },
            });
            if (hrUser) {
              approvalStepsData.push({
                leaveRequestId: id,
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

      // Update pending balance
      const lt = leaveRequest.leaveTypeConfig;
      if (lt.deductsFromBalance && lt.balanceType) {
        await prisma.leaveBalance.update({
          where: {
            userId_year_balanceType: {
              userId: session.user.id,
              year: leaveRequest.startDate.getFullYear(),
              balanceType: lt.balanceType,
            },
          },
          data: { pendingDays: { increment: leaveRequest.totalDays } },
        });
      }

      // Audit log for submit
      const ip = getRequestIp(request.headers);
      createAuditLog({
        userId: session.user.id,
        action: "LEAVE_SUBMIT",
        entityType: "LeaveRequest",
        entityId: id,
        ipAddress: ip,
        newValue: {
          previousStatus: leaveRequest.status,
          newStatus: "PENDING_MANAGER",
          totalDays: leaveRequest.totalDays,
          leaveType: lt.code,
        },
      }).catch(() => {});

      return NextResponse.json({ status: "PENDING_MANAGER" });
    }

    case "cancel": {
      // Can cancel DRAFT or PENDING requests
      if (!["DRAFT", "PENDING_MANAGER", "PENDING_HR"].includes(leaveRequest.status)) {
        return NextResponse.json(
          { error: "Cette demande ne peut pas être annulée" },
          { status: 400 }
        );
      }

      const wasPending = leaveRequest.status !== "DRAFT";

      await prisma.leaveRequest.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      // Restore pending balance if was submitted
      const ltc = leaveRequest.leaveTypeConfig;
      if (wasPending && ltc.deductsFromBalance && ltc.balanceType) {
        await prisma.leaveBalance.update({
          where: {
            userId_year_balanceType: {
              userId: session.user.id,
              year: leaveRequest.startDate.getFullYear(),
              balanceType: ltc.balanceType,
            },
          },
          data: { pendingDays: { decrement: leaveRequest.totalDays } },
        });
      }

      // Audit log for cancel
      const cancelIp = getRequestIp(request.headers);
      createAuditLog({
        userId: session.user.id,
        action: "LEAVE_CANCEL",
        entityType: "LeaveRequest",
        entityId: id,
        ipAddress: cancelIp,
        newValue: {
          previousStatus: leaveRequest.status,
          newStatus: "CANCELLED",
          totalDays: leaveRequest.totalDays,
          leaveType: ltc.code,
        },
      }).catch(() => {});

      return NextResponse.json({ status: "CANCELLED" });
    }

    default:
      return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  }
}

// ─── PUT: update a DRAFT or RETURNED leave request ───

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  // RBAC: only the leave owner can edit
  const ownerDenied = await requireOwnerOfLeave(session?.user, id);
  if (ownerDenied) return ownerDenied;

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { leaveTypeConfig: true },
  });

  if (!leaveRequest) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }

  if (leaveRequest.status !== "DRAFT" && leaveRequest.status !== "RETURNED") {
    return NextResponse.json(
      { error: "Seuls les brouillons ou demandes renvoyées peuvent être modifiés" },
      { status: 400 }
    );
  }

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

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Dates invalides" }, { status: 400 });
  }
  if (endDate < startDate) {
    return NextResponse.json(
      { error: "La date de fin doit être après la date de début" },
      { status: 400 }
    );
  }

  // Get user + office for working days calculation
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

  // Calculate working days
  const DAY_MAP: Record<string, number> = {
    SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
  };
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

  let totalDays = 0;
  const current = new Date(startDate);
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split("T")[0];
    if (workingDayNumbers.has(dayOfWeek) && !holidaySet.has(dateStr)) {
      if (current.getTime() === startDate.getTime() && current.getTime() === endDate.getTime()) {
        if (data.startHalfDay === "MORNING" || data.startHalfDay === "AFTERNOON") totalDays += 0.5;
        else if (data.endHalfDay === "MORNING" || data.endHalfDay === "AFTERNOON") totalDays += 0.5;
        else totalDays += 1;
      } else if (current.getTime() === startDate.getTime()) {
        totalDays += data.startHalfDay === "AFTERNOON" ? 0.5 : 1;
      } else if (current.getTime() === endDate.getTime()) {
        totalDays += data.endHalfDay === "MORNING" ? 0.5 : 1;
      } else {
        totalDays += 1;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  if (totalDays <= 0) {
    return NextResponse.json(
      { error: "La période sélectionnée ne contient aucun jour ouvré" },
      { status: 400 }
    );
  }

  // Attachment URLs (pre-uploaded via /api/upload)
  const attachmentUrlsRaw = formData.get("attachmentUrls") as string | null;
  const attachmentUrls: string[] = attachmentUrlsRaw
    ? attachmentUrlsRaw.split(",").map((u) => u.trim()).filter(Boolean)
    : [];

  await prisma.leaveRequest.update({
    where: { id },
    data: {
      leaveTypeConfigId: data.leaveTypeConfigId,
      startDate,
      endDate,
      startHalfDay: data.startHalfDay as "FULL_DAY" | "MORNING" | "AFTERNOON",
      endHalfDay: data.endHalfDay as "FULL_DAY" | "MORNING" | "AFTERNOON",
      totalDays,
      reason: data.reason || null,
      exceptionalReason: data.exceptionalReason || null,
      attachmentUrls,
    },
  });

  // Audit log
  const ip = getRequestIp(request.headers);
  createAuditLog({
    userId: session.user.id,
    action: "LEAVE_UPDATE",
    entityType: "LeaveRequest",
    entityId: id,
    ipAddress: ip,
    newValue: {
      leaveTypeConfigId: data.leaveTypeConfigId,
      startDate: data.startDate,
      endDate: data.endDate,
      totalDays,
    },
  }).catch(() => {});

  return NextResponse.json({ id, status: leaveRequest.status });
}
