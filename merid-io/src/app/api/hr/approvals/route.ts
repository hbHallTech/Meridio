import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { LeaveStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  const denied = requireRoles(session?.user, "HR", "ADMIN");
  if (denied) return denied;

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));
  const skip = (page - 1) * limit;

  // Fetch leave requests that are PENDING_HR with a pending HR approval step
  const where = {
    status: LeaveStatus.PENDING_HR,
    approvalSteps: {
      some: {
        stepType: "HR" as const,
        action: null,
      },
    },
  };

  const [items, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        startHalfDay: true,
        endHalfDay: true,
        totalDays: true,
        status: true,
        reason: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
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
          orderBy: { stepOrder: "asc" },
          select: {
            id: true,
            stepType: true,
            stepOrder: true,
            action: true,
            comment: true,
            decidedAt: true,
            approver: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    }),
    prisma.leaveRequest.count({ where }),
  ]);

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
