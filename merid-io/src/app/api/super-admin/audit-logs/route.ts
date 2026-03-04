import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma, UserRole } from "@prisma/client";

/**
 * GET /api/super-admin/audit-logs
 *
 * Cross-tenant audit log viewer for SUPER_ADMIN.
 * Unlike /api/admin/audit which is scoped to the admin's company,
 * this endpoint shows ALL audit logs across all tenants.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  const roles = (session?.user?.roles ?? []) as UserRole[];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const where: Prisma.AuditLogWhereInput = {};

  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const action = searchParams.get("action");
  const userId = searchParams.get("userId");
  const search = searchParams.get("search")?.trim();

  if (startDate || endDate) {
    const createdAtFilter: Record<string, Date> = {};
    if (startDate) createdAtFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      createdAtFilter.lte = end;
    }
    where.createdAt = createdAtFilter;
  }

  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (search) {
    where.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { entityType: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 50));
  const skip = (page - 1) * pageSize;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            office: { select: { company: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    logs: logs.map((l) => ({
      ...l,
      companyName: l.user?.office?.company?.name || null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
