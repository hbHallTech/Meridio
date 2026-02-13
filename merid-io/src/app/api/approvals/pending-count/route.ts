import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeaveStatus } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ count: 0 });
  }

  const count = await prisma.approvalStep.count({
    where: {
      approverId: session.user.id,
      action: null,
      leaveRequest: {
        status: {
          in: [LeaveStatus.PENDING_MANAGER, LeaveStatus.PENDING_HR],
        },
      },
    },
  });

  return NextResponse.json({ count });
}
