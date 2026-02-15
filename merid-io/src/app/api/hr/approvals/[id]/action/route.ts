import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approvalSchema } from "@/lib/validators";
import { createAuditLog } from "@/lib/notifications";
import { getRequestIp } from "@/lib/rate-limit";
import { LeaveStatus, ApprovalAction } from "@prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("HR") && !roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  const { id: leaveRequestId } = await params;
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
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: {
      approvalSteps: { orderBy: { stepOrder: "asc" } },
      user: { select: { id: true, firstName: true, lastName: true } },
      leaveTypeConfig: { select: { deductsFromBalance: true, balanceType: true } },
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
      approverId: session.user.id,
    },
  });

  // Determine new leave request status
  let newStatus: LeaveStatus;

  if (action === "APPROVED") {
    // Check if there are more pending steps after this one
    const pendingSteps = leaveRequest.approvalSteps.filter(
      (s) => s.id !== hrStep.id && s.action === null
    );
    newStatus = pendingSteps.length > 0 ? leaveRequest.status : LeaveStatus.APPROVED;
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

  // Update balance on final decision
  if (
    leaveRequest.leaveTypeConfig.deductsFromBalance &&
    leaveRequest.leaveTypeConfig.balanceType
  ) {
    const year = leaveRequest.startDate.getFullYear();
    const balanceType = leaveRequest.leaveTypeConfig.balanceType;

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

  // Audit log
  await createAuditLog({
    userId: session.user.id,
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
