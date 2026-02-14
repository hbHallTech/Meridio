import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendLeaveApprovalEmail } from "@/lib/email";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const comment = body.comment as string;

  if (!comment || comment.trim().length === 0) {
    return NextResponse.json(
      { error: "Le motif de renvoi est obligatoire" },
      { status: 400 }
    );
  }

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      leaveTypeConfig: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
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
      { error: "Cette demande ne peut pas être renvoyée dans son état actuel" },
      { status: 400 }
    );
  }

  const currentUserId = session.user.id;
  const now = new Date();

  // Check delegations
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
  const allowedApproverIds = [currentUserId, ...delegatorIds];

  const pendingStep = leaveRequest.approvalSteps.find(
    (step) => step.action === null && allowedApproverIds.includes(step.approverId)
  );

  if (!pendingStep) {
    return NextResponse.json(
      { error: "Vous n'êtes pas autorisé à renvoyer cette demande" },
      { status: 403 }
    );
  }

  // Update the approval step
  await prisma.approvalStep.update({
    where: { id: pendingStep.id },
    data: {
      action: "RETURNED",
      comment: comment.trim(),
      decidedAt: now,
    },
  });

  // Set leave status to RETURNED
  await prisma.leaveRequest.update({
    where: { id },
    data: { status: "RETURNED" },
  });

  // Restore pending balance
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
      },
    });
  }

  // Create notification
  await prisma.notification.create({
    data: {
      userId: leaveRequest.userId,
      type: "RETURNED",
      title_fr: "Demande renvoyée",
      title_en: "Request returned",
      body_fr: `Votre demande de congé a été renvoyée en brouillon. Motif : ${comment.trim()}`,
      body_en: `Your leave request has been returned to draft. Reason: ${comment.trim()}`,
      data: { leaveRequestId: id },
      sentByEmail: true,
    },
  });

  // Send email
  try {
    const leaveTypeLabel = leaveRequest.leaveTypeConfig.label_fr;
    const startDate = leaveRequest.startDate.toLocaleDateString("fr-FR");
    const endDate = leaveRequest.endDate.toLocaleDateString("fr-FR");

    await sendLeaveApprovalEmail(
      leaveRequest.user.email,
      `${leaveRequest.user.firstName} ${leaveRequest.user.lastName}`,
      leaveTypeLabel,
      startDate,
      endDate,
      "returned",
      comment.trim()
    );
  } catch (e) {
    console.error("[EMAIL ERROR] Failed to send return email:", e);
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: currentUserId,
      action: "LEAVE_RETURNED",
      entityType: "LeaveRequest",
      entityId: id,
      newValue: { status: "RETURNED", comment: comment.trim(), stepId: pendingStep.id },
    },
  });

  return NextResponse.json({ status: "RETURNED" });
}
