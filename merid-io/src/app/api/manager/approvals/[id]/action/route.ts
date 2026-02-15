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
  if (!roles.includes("MANAGER") && !roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  const { id: leaveRequestId } = await params;
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
      leaveTypeConfig: { select: { deductsFromBalance: true, balanceType: true } },
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
      approverId: session.user.id,
    },
  });

  // Determine new status
  let newStatus: LeaveStatus;

  if (action === "APPROVED") {
    // Check if there is an HR step after this
    const hrStep = leaveRequest.approvalSteps.find(
      (s) => s.stepType === "HR" && s.action === null && s.id !== managerStep.id
    );
    newStatus = hrStep ? LeaveStatus.PENDING_HR : LeaveStatus.APPROVED;
  } else if (action === "REFUSED") {
    newStatus = LeaveStatus.REFUSED;
  } else {
    newStatus = LeaveStatus.RETURNED;
  }

  await prisma.leaveRequest.update({
    where: { id: leaveRequestId },
    data: { status: newStatus },
  });

  // Update balance on final decision (no HR step after)
  if (
    newStatus !== LeaveStatus.PENDING_HR &&
    leaveRequest.leaveTypeConfig.deductsFromBalance &&
    leaveRequest.leaveTypeConfig.balanceType
  ) {
    const year = leaveRequest.startDate.getFullYear();
    const balanceType = leaveRequest.leaveTypeConfig.balanceType;

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

  await createAuditLog({
    userId: session.user.id,
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
