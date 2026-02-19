import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approvalSchema } from "@/lib/validators";
import { requireRoles, requireHrApproverOfLeave } from "@/lib/rbac";
import {
  createAuditLog,
  notifyLeaveApproved,
  notifyLeaveRejected,
  notifyLeaveNeedsRevision,
} from "@/lib/notifications";
import { getRequestIp } from "@/lib/rate-limit";
import { LeaveStatus, ApprovalAction } from "@prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  // Defense-in-depth: role check (even though middleware also checks)
  const denied = requireRoles(session?.user, "HR", "ADMIN");
  if (denied) return denied;
  // After requireRoles passes, session.user.id is guaranteed
  const currentUserId = session!.user.id!;

  const { id: leaveRequestId } = await params;

  // Defense-in-depth: verify this HR user is actually assigned as approver
  const approverDenied = await requireHrApproverOfLeave(session?.user, leaveRequestId);
  if (approverDenied) return approverDenied;
  const body = await request.json();
  const parsed = approvalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { action, comment } = parsed.data;

  // Require comment for REFUSED and RETURNED
  if ((action === "REFUSED" || action === "RETURNED") && !comment?.trim()) {
    return NextResponse.json(
      { error: "Un commentaire est requis pour un refus ou un renvoi." },
      { status: 400 }
    );
  }

  // Find the leave request
  // Bug5: Include code to check for EXCEPTIONAL type
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: {
      approvalSteps: { orderBy: { stepOrder: "asc" } },
      user: { select: { id: true, firstName: true, lastName: true } },
      leaveTypeConfig: { select: { code: true, label_fr: true, deductsFromBalance: true, balanceType: true } },
    },
  });

  if (!leaveRequest) {
    return NextResponse.json(
      { error: "Demande introuvable" },
      { status: 404 }
    );
  }

  if (leaveRequest.status !== LeaveStatus.PENDING_HR) {
    return NextResponse.json(
      { error: "Cette demande n'est pas en attente d'approbation RH." },
      { status: 400 }
    );
  }

  // Find the pending HR step
  const hrStep = leaveRequest.approvalSteps.find(
    (s) => s.stepType === "HR" && s.action === null
  );

  if (!hrStep) {
    return NextResponse.json(
      { error: "Aucune etape d'approbation RH en attente." },
      { status: 400 }
    );
  }

  const now = new Date();
  const ip = getRequestIp(request.headers);
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  // Update the approval step
  await prisma.approvalStep.update({
    where: { id: hrStep.id },
    data: {
      action: action as ApprovalAction,
      comment: comment?.trim() || null,
      decidedAt: now,
      approverId: currentUserId,
    },
  });

  // Determine new leave request status
  let newStatus: LeaveStatus;

  if (action === "APPROVED") {
    // In parallel workflows, check if ALL other HR steps are also approved
    const pendingHrSteps = leaveRequest.approvalSteps.filter(
      (s) => s.stepType === "HR" && s.action === null && s.id !== hrStep.id
    );

    if (pendingHrSteps.length > 0) {
      // Other HR approvers still need to approve (parallel workflow)
      newStatus = LeaveStatus.PENDING_HR;
    } else {
      // All HR steps approved — check for any other non-HR pending steps
      const otherPending = leaveRequest.approvalSteps.filter(
        (s) => s.id !== hrStep.id && s.action === null && s.stepType !== "HR"
      );
      newStatus = otherPending.length > 0 ? leaveRequest.status : LeaveStatus.APPROVED;
    }
  } else if (action === "REFUSED") {
    newStatus = LeaveStatus.REFUSED;
  } else {
    // RETURNED
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

  console.log(`Bug5: HR approval - code=${leaveRequest.leaveTypeConfig.code}, isExceptional=${isExceptional}, shouldUpdateBalance=${!!shouldUpdateBalance}`);

  // Update balance on final decision
  if (shouldUpdateBalance) {
    const year = leaveRequest.startDate.getFullYear();
    const balanceType = leaveRequest.leaveTypeConfig.balanceType!;

    if (action === "APPROVED") {
      // Move from pending to used
      await prisma.leaveBalance.updateMany({
        where: {
          userId: leaveRequest.userId,
          year,
          balanceType,
        },
        data: {
          pendingDays: { decrement: leaveRequest.totalDays },
          usedDays: { increment: leaveRequest.totalDays },
        },
      });
    } else if (action === "REFUSED" || action === "RETURNED") {
      // Restore pending days
      await prisma.leaveBalance.updateMany({
        where: {
          userId: leaveRequest.userId,
          year,
          balanceType,
        },
        data: {
          pendingDays: { decrement: leaveRequest.totalDays },
        },
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
    : "RH";
  const startDateStr = leaveRequest.startDate.toISOString().split("T")[0];
  const endDateStr = leaveRequest.endDate.toISOString().split("T")[0];

  if (action === "APPROVED" && newStatus === LeaveStatus.APPROVED) {
    notifyLeaveApproved(leaveRequest.userId, {
      leaveRequestId,
      leaveType: leaveRequest.leaveTypeConfig.label_fr,
      startDate: startDateStr,
      endDate: endDateStr,
      approverName,
    }).catch((err) => console.log("Bug1: Error notifying HR approval:", err));
  } else if (action === "REFUSED") {
    notifyLeaveRejected(leaveRequest.userId, {
      leaveRequestId,
      leaveType: leaveRequest.leaveTypeConfig.label_fr,
      startDate: startDateStr,
      endDate: endDateStr,
      approverName,
      comment: comment?.trim() || "",
    }).catch((err) => console.log("Bug1: Error notifying HR rejection:", err));
  } else if (action === "RETURNED") {
    notifyLeaveNeedsRevision(leaveRequest.userId, {
      leaveRequestId,
      leaveType: leaveRequest.leaveTypeConfig.label_fr,
      startDate: startDateStr,
      endDate: endDateStr,
      approverName,
      comment: comment?.trim() || "",
    }).catch((err) => console.log("Bug1: Error notifying HR return:", err));
  }

  // Audit log
  await createAuditLog({
    userId: currentUserId,
    action: `HR_APPROVAL_${action}`,
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

  return NextResponse.json({
    success: true,
    newStatus,
  });
}
