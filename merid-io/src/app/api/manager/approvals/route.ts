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
  if (!hasPermission(userRoles, "leave:approve")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") ?? "pending";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));
  const skip = (page - 1) * limit;

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
    include: {
      fromUser: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  // Map of delegator user IDs to their names
  const delegatorMap = new Map<string, string>();
  for (const d of activeDelegations) {
    delegatorMap.set(d.fromUserId, `${d.fromUser.firstName} ${d.fromUser.lastName}`);
  }

  const allApproverIds = [currentUserId, ...delegatorMap.keys()];

  if (tab === "pending") {
    // Find pending approval steps assigned to user (directly or via delegation)
    const where = {
      approverId: { in: allApproverIds },
      action: null,
      leaveRequest: {
        status: {
          in: [LeaveStatus.PENDING_MANAGER, LeaveStatus.PENDING_HR],
        },
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
      const isDelegated = step.approverId !== currentUserId;
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
        user: lr.user,
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
        isDelegated,
        delegatedFromName: isDelegated ? delegatorMap.get(step.approverId) : undefined,
      };
    });

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } else {
    // History: approval steps that have been decided by the user (or delegators)
    const where = {
      approverId: { in: allApproverIds },
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
      const isDelegated = step.approverId !== currentUserId;
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
        user: lr.user,
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
        isDelegated,
        delegatedFromName: isDelegated ? delegatorMap.get(step.approverId) : undefined,
      };
    });

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
}
