import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

/**
 * GET /api/super-admin/tenants
 *
 * Returns all companies (tenants) with aggregated stats.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  const roles = (session?.user?.roles ?? []) as UserRole[];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search")?.trim();

  const companies = await prisma.company.findMany({
    where: search
      ? { name: { contains: search, mode: "insensitive" } }
      : undefined,
    include: {
      offices: {
        select: {
          id: true,
          name: true,
          city: true,
          country: true,
          _count: { select: { users: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Build tenant list with aggregated stats
  const tenants = await Promise.all(
    companies.map(async (company) => {
      const officeIds = company.offices.map((o) => o.id);

      const [userCount, activeUserCount, lastLogin] = await Promise.all([
        prisma.user.count({
          where: { officeId: { in: officeIds } },
        }),
        prisma.user.count({
          where: { officeId: { in: officeIds }, isActive: true },
        }),
        prisma.auditLog.findFirst({
          where: {
            action: "LOGIN_SUCCESS",
            userId: { not: null },
            user: { officeId: { in: officeIds } },
          },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ]);

      return {
        id: company.id,
        name: company.name,
        city: company.city,
        country: company.country,
        websiteUrl: company.websiteUrl,
        createdAt: company.createdAt,
        officeCount: company.offices.length,
        userCount,
        activeUserCount,
        lastActivity: lastLogin?.createdAt || null,
        offices: company.offices.map((o) => ({
          id: o.id,
          name: o.name,
          city: o.city,
          userCount: o._count.users,
        })),
      };
    })
  );

  return NextResponse.json(tenants);
}
