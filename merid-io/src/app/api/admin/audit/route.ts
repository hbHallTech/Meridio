import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const action = searchParams.get("action");

  // Build where clause
  const where: Record<string, unknown> = {};

  if (startDate || endDate) {
    const createdAtFilter: Record<string, Date> = {};
    if (startDate) {
      createdAtFilter.gte = new Date(startDate);
    }
    if (endDate) {
      // Set to end of day
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      createdAtFilter.lte = end;
    }
    where.createdAt = createdAtFilter;
  }

  if (action) {
    where.action = action;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(logs);
}
