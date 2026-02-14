import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeaveStatus } from "@prisma/client";
import { sendLeaveApprovalEmail } from "@/lib/email";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  // Find the leave request with its approval steps and workflow
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      leaveTypeConfig: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, officeId: true },
      },
      approvalSteps: {
        orderBy: { stepOrder: "asc" },
      },
    },
  });

  if (!leaveRequest) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }

  if (!["PENDING_MANAGER", "PENDING_HR"].includes(leaveRequest.status)) {
    return NextResponse.json(
      { error: "Cette demande ne peut pas être approuvée dans son état actuel" },
      { status: 400 }
    );
  }

  // Check if user is an approver for this request (direct or delegate)
  const currentUserId = session.user.id;
  const now = new Date();

  // Find active delegations where someone delegated to the current user
  const activeDelegations = await prisma.delegation.findMany({
    where: {
      toUserId: currentUserId,
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    select: { fromUserId: true },
  });
  const delegatorIds = activeDelegations.map((d) => d.fromUserId);

  // Find the pending step assigned to the current user or a delegator
  const allowedApproverIds = [currentUserId, ...delegatorIds];
  const pendingStep = leaveRequest.approvalSteps.find(
    (step) => step.action === null && allowedApproverIds.includes(step.approverId)
  );

  if (!pendingStep) {
    return NextResponse.json(
      { error: "Vous n'êtes pas autorisé à approuver cette demande" },
      { status: 403 }
    );
  }

  // Update the approval step
  await prisma.approvalStep.update({
    where: { id: pendingStep.id },
    data: {
      action: "APPROVED",
      comment: null,
      decidedAt: now,
    },
  });

  // Check if there is a next step
  const nextStep = leaveRequest.approvalSteps.find(
    (step) => step.stepOrder > pendingStep.stepOrder && step.action === null
  );

  let newStatus: LeaveStatus;

  if (nextStep) {
    // Sequential workflow: move to the next step
    newStatus = nextStep.stepType === "HR" ? "PENDING_HR" : "PENDING_MANAGER";
  } else {
    // Last step → APPROVED
    newStatus = "APPROVED";
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: { status: newStatus },
  });

  // If fully approved, move pending balance to used
  if (newStatus === "APPROVED") {
    const lt = leaveRequest.leaveTypeConfig;
    if (lt.deductsFromBalance && lt.balanceType) {
      await prisma.leaveBalance.update({
        where: {
          userId_year_balanceType: {
            userId: leaveRequest.userId,
            year: leaveRequest.startDate.getFullYear(),
            balanceType: lt.balanceType,
          },
        },
        data: {
          pendingDays: { decrement: leaveRequest.totalDays },
          usedDays: { increment: leaveRequest.totalDays },
        },
      });
    }
  }

  // Create notification
  const employeeName = `${leaveRequest.user.firstName} ${leaveRequest.user.lastName}`;
  const statusLabel = newStatus === "APPROVED" ? "approuvée" : "en cours de validation";

  await prisma.notification.create({
    data: {
      userId: leaveRequest.userId,
      type: newStatus === "APPROVED" ? "APPROVED" : "NEW_REQUEST",
      title_fr: newStatus === "APPROVED" ? "Demande approuvée" : "Étape validée",
      title_en: newStatus === "APPROVED" ? "Request approved" : "Step validated",
      body_fr: `Votre demande de congé a été ${statusLabel}.`,
      body_en: `Your leave request has been ${newStatus === "APPROVED" ? "approved" : "moved to next validation step"}.`,
      data: { leaveRequestId: id },
      sentByEmail: true,
    },
  });

  // Send email notification
  try {
    const leaveTypeLabel = leaveRequest.leaveTypeConfig.label_fr;
    const startDate = leaveRequest.startDate.toLocaleDateString("fr-FR");
    const endDate = leaveRequest.endDate.toLocaleDateString("fr-FR");

    await sendLeaveApprovalEmail(
      leaveRequest.user.email,
      employeeName,
      leaveTypeLabel,
      startDate,
      endDate,
      "approved"
    );
  } catch (e) {
    console.error("[EMAIL ERROR] Failed to send approval email:", e);
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: currentUserId,
      action: "LEAVE_APPROVED",
      entityType: "LeaveRequest",
      entityId: id,
      newValue: { status: newStatus, stepId: pendingStep.id },
    },
  });

  return NextResponse.json({ status: newStatus });
}
