import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEmailStats } from "@/lib/email-queue";
import type { UserRole, EmailStatus, EmailType } from "@prisma/client";

/**
 * GET /api/super-admin/email-logs
 *
 * Returns email delivery logs and stats for the super admin dashboard.
 * Supports filtering by status, type, and search.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  const roles = (session?.user?.roles ?? []) as UserRole[];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as EmailStatus | null;
  const type = searchParams.get("type") as EmailType | null;
  const search = searchParams.get("search");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 20));

  // Build filter
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (search) {
    where.OR = [
      { to: { contains: search, mode: "insensitive" } },
      { subject: { contains: search, mode: "insensitive" } },
    ];
  }

  const [logs, total, stats] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        to: true,
        subject: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        lastError: true,
        nextRetryAt: true,
        sentAt: true,
        createdAt: true,
        updatedAt: true,
        signupRequestId: true,
        companyId: true,
        userId: true,
      },
    }),
    prisma.emailLog.count({ where }),
    getEmailStats(),
  ]);

  return NextResponse.json({
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    stats,
  });
}
