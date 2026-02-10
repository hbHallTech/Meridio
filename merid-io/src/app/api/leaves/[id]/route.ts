import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  if (!leaveRequest) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }

  // Only the owner can see their own request via this endpoint
  if (leaveRequest.userId !== session.user.id) {
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

      await prisma.leaveRequest.update({
        where: { id },
        data: { status: "PENDING_MANAGER" },
      });

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

      return NextResponse.json({ status: "CANCELLED" });
    }

    default:
      return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  }
}
