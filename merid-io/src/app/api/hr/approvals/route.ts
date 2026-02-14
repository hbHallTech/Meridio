import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeaveStatus } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "hr:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") ?? "pending";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));
  const skip = (page - 1) * limit;

  const currentUserId = session.user.id;

  if (tab === "pending") {
    // HR step: only show PENDING_HR requests with undecided HR steps
    const where = {
      stepType: "HR" as const,
      action: null,
      leaveRequest: {
        status: LeaveStatus.PENDING_HR,
      },
    };

    const [total, steps] = await Promise.all([
      prisma.approvalStep.count({ where }),
      prisma.approvalStep.findMany({
        where,
        include: {
          leaveRequest: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profilePictureUrl: true,
                  office: { select: { name: true, city: true } },
                  team: { select: { name: true } },
                },
              },
              leaveTypeConfig: {
                select: {
                  id: true,
                  code: true,
                  label_fr: true,
                  label_en: true,
                  color: true,
                },
              },
              approvalSteps: {
                include: {
                  approver: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
                orderBy: { stepOrder: "asc" },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
    ]);

    const items = steps.map((step) => {
      const lr = step.leaveRequest;
      return {
        id: lr.id,
        startDate: lr.startDate,
        endDate: lr.endDate,
        startHalfDay: lr.startHalfDay,
        endHalfDay: lr.endHalfDay,
        totalDays: lr.totalDays,
        status: lr.status,
        reason: lr.reason,
        exceptionalReason: lr.exceptionalReason,
        attachmentUrls: lr.attachmentUrls,
        createdAt: lr.createdAt,
        user: {
          ...lr.user,
          officeName: lr.user.office?.name,
          teamName: lr.user.team?.name,
        },
        leaveType: lr.leaveTypeConfig,
        approvalSteps: lr.approvalSteps.map((s) => ({
          id: s.id,
          stepType: s.stepType,
          stepOrder: s.stepOrder,
          action: s.action,
          comment: s.comment,
          decidedAt: s.decidedAt,
          approver: s.approver,
        })),
      };
    });

    return NextResponse.json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } else {
    // History: HR steps decided by the current user
    const where = {
      stepType: "HR" as const,
      approverId: currentUserId,
      action: { not: null as null },
    };

    const [total, steps] = await Promise.all([
      prisma.approvalStep.count({ where }),
      prisma.approvalStep.findMany({
        where,
        include: {
          leaveRequest: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profilePictureUrl: true,
                  office: { select: { name: true, city: true } },
                  team: { select: { name: true } },
                },
              },
              leaveTypeConfig: {
                select: {
                  id: true,
                  code: true,
                  label_fr: true,
                  label_en: true,
                  color: true,
                },
              },
              approvalSteps: {
                include: {
                  approver: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
                orderBy: { stepOrder: "asc" },
              },
            },
          },
        },
        orderBy: { decidedAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    const items = steps.map((step) => {
      const lr = step.leaveRequest;
      return {
        id: lr.id,
        startDate: lr.startDate,
        endDate: lr.endDate,
        startHalfDay: lr.startHalfDay,
        endHalfDay: lr.endHalfDay,
        totalDays: lr.totalDays,
        status: lr.status,
        reason: lr.reason,
        exceptionalReason: lr.exceptionalReason,
        attachmentUrls: lr.attachmentUrls,
        createdAt: lr.createdAt,
        user: {
          ...lr.user,
          officeName: lr.user.office?.name,
          teamName: lr.user.team?.name,
        },
        leaveType: lr.leaveTypeConfig,
        approvalSteps: lr.approvalSteps.map((s) => ({
          id: s.id,
          stepType: s.stepType,
          stepOrder: s.stepOrder,
          action: s.action,
          comment: s.comment,
          decidedAt: s.decidedAt,
          approver: s.approver,
        })),
      };
    });

    return NextResponse.json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }
}
