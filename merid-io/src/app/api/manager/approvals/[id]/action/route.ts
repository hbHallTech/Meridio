import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approvalSchema } from "@/lib/validators";
import { requireRoles, requireManagerOfLeave } from "@/lib/rbac";
import {
  createAuditLog,
  notifyLeaveApproved,
  notifyLeaveRejected,
  notifyLeaveNeedsRevision,
  notifyNewLeaveRequest,
} from "@/lib/notifications";
import { getRequestIp } from "@/lib/rate-limit";
import { LeaveStatus, ApprovalAction } from "@prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  // Defense-in-depth: role check (even though middleware also checks)
  const denied = requireRoles(session?.user, "MANAGER", "ADMIN");
  if (denied) return denied;
  // After requireRoles passes, session.user.id is guaranteed
  const currentUserId = session!.user.id!;

  const { id: leaveRequestId } = await params;

  // Defense-in-depth: verify this manager actually manages the requester's team
  const ownershipDenied = await requireManagerOfLeave(session?.user, leaveRequestId);
  if (ownershipDenied) return ownershipDenied;
  const body = await request.json();
  const parsed = approvalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { action, comment } = parsed.data;

  if ((action === "REFUSED" || action === "RETURNED") && !comment?.trim()) {
    return NextResponse.json(
      { error: "Un commentaire est requis pour un refus ou un renvoi." },
      { status: 400 }
    );
  }

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: {
      approvalSteps: { orderBy: { stepOrder: "asc" } },
      user: { select: { id: true, firstName: true, lastName: true, teamId: true } },
      // Bug5: Include code to check for EXCEPTIONAL type
      leaveTypeConfig: { select: { code: true, label_fr: true, deductsFromBalance: true, balanceType: true } },
    },
  });

  if (!leaveRequest) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }

  if (leaveRequest.status !== LeaveStatus.PENDING_MANAGER) {
    return NextResponse.json(
      { error: "Cette demande n'est pas en attente d'approbation manager." },
      { status: 400 }
    );
  }

  // Find the pending MANAGER step
  const managerStep = leaveRequest.approvalSteps.find(
    (s) => s.stepType === "MANAGER" && s.action === null
  );

  if (!managerStep) {
    return NextResponse.json(
      { error: "Aucune etape d'approbation manager en attente." },
      { status: 400 }
    );
  }

  const now = new Date();
  const ip = getRequestIp(request.headers);
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  // Update the approval step
  await prisma.approvalStep.update({
    where: { id: managerStep.id },
    data: {
      action: action as ApprovalAction,
      comment: comment?.trim() || null,
      decidedAt: now,
      approverId: currentUserId,
    },
  });

  // Determine new status
  let newStatus: LeaveStatus;

  if (action === "APPROVED") {
    // In parallel workflows, check if ALL other MANAGER steps are also approved
    const pendingManagerSteps = leaveRequest.approvalSteps.filter(
      (s) => s.stepType === "MANAGER" && s.action === null && s.id !== managerStep.id
    );

    if (pendingManagerSteps.length > 0) {
      // Other managers still need to approve (parallel workflow)
      newStatus = LeaveStatus.PENDING_MANAGER;
    } else {
      // All managers approved — check if there is an HR step after this
      const hrStep = leaveRequest.approvalSteps.find(
        (s) => s.stepType === "HR" && s.action === null
      );
      newStatus = hrStep ? LeaveStatus.PENDING_HR : LeaveStatus.APPROVED;
    }
  } else if (action === "REFUSED") {
    newStatus = LeaveStatus.REFUSED;
  } else {
    newStatus = LeaveStatus.RETURNED;
  }

  await prisma.leaveRequest.update({
    where: { id: leaveRequestId },
    data: { status: newStatus },
  });

  // Bug5: Check for EXCEPTIONAL type — never deduct from balance
  const isExceptional = leaveRequest.leaveTypeConfig.code === "EXCEPTIONAL";
  const shouldUpdateBalance =
    !isExceptional &&
    leaveRequest.leaveTypeConfig.deductsFromBalance &&
    leaveRequest.leaveTypeConfig.balanceType;

  console.log(`Bug5: Manager approval - code=${leaveRequest.leaveTypeConfig.code}, isExceptional=${isExceptional}, shouldUpdateBalance=${!!shouldUpdateBalance}`);

  // Update balance on final decision (no HR step after)
  if (newStatus !== LeaveStatus.PENDING_HR && shouldUpdateBalance) {
    const year = leaveRequest.startDate.getFullYear();
    const balanceType = leaveRequest.leaveTypeConfig.balanceType!;

    if (action === "APPROVED") {
      await prisma.leaveBalance.updateMany({
        where: { userId: leaveRequest.userId, year, balanceType },
        data: {
          pendingDays: { decrement: leaveRequest.totalDays },
          usedDays: { increment: leaveRequest.totalDays },
        },
      });
    } else if (action === "REFUSED" || action === "RETURNED") {
      await prisma.leaveBalance.updateMany({
        where: { userId: leaveRequest.userId, year, balanceType },
        data: { pendingDays: { decrement: leaveRequest.totalDays } },
      });
    }
  }

  // Bug1: Send notification to employee based on action
  const approverUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { firstName: true, lastName: true },
  });
  const approverName = approverUser
    ? `${approverUser.firstName} ${approverUser.lastName}`
    : "Manager";
  const startDateStr = leaveRequest.startDate.toISOString().split("T")[0];
  const endDateStr = leaveRequest.endDate.toISOString().split("T")[0];

  if (action === "APPROVED" && newStatus === LeaveStatus.APPROVED) {
    notifyLeaveApproved(leaveRequest.userId, {
      leaveRequestId,
      leaveType: leaveRequest.leaveTypeConfig.label_fr,
      startDate: startDateStr,
      endDate: endDateStr,
      approverName,
    }).catch((err) => console.log("Bug1: Error notifying approval:", err));
  } else if (action === "APPROVED" && newStatus === LeaveStatus.PENDING_HR) {
    // Bug4: Notify HR approver(s) for next step
    const hrSteps = leaveRequest.approvalSteps.filter(
      (s) => s.stepType === "HR" && s.action === null && s.id !== managerStep.id
    );
    if (hrSteps.length > 0) {
      const hrApproverIds = hrSteps.map((s) => s.approverId);
      notifyNewLeaveRequest(hrApproverIds, {
        leaveRequestId,
        employeeName: `${leaveRequest.user.firstName} ${leaveRequest.user.lastName}`,
        leaveType: leaveRequest.leaveTypeConfig.label_fr,
        startDate: startDateStr,
        endDate: endDateStr,
        totalDays: leaveRequest.totalDays,
      }).catch((err) => console.log("Bug1: Error notifying HR step:", err));
    }
  } else if (action === "REFUSED") {
    notifyLeaveRejected(leaveRequest.userId, {
      leaveRequestId,
      leaveType: leaveRequest.leaveTypeConfig.label_fr,
      startDate: startDateStr,
      endDate: endDateStr,
      approverName,
      comment: comment?.trim() || "",
    }).catch((err) => console.log("Bug1: Error notifying rejection:", err));
  } else if (action === "RETURNED") {
    notifyLeaveNeedsRevision(leaveRequest.userId, {
      leaveRequestId,
      leaveType: leaveRequest.leaveTypeConfig.label_fr,
      startDate: startDateStr,
      endDate: endDateStr,
      approverName,
      comment: comment?.trim() || "",
    }).catch((err) => console.log("Bug1: Error notifying return:", err));
  }

  await createAuditLog({
    userId: currentUserId,
    action: `MANAGER_APPROVAL_${action}`,
    entityType: "LeaveRequest",
    entityId: leaveRequestId,
    ipAddress: ip,
    newValue: {
      action,
      comment: comment?.trim() || null,
      employeeId: leaveRequest.userId,
      employeeName: `${leaveRequest.user.firstName} ${leaveRequest.user.lastName}`,
      userAgent,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, newStatus });
}
