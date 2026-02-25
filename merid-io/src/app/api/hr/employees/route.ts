import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/hr/employees
 *
 * Returns the list of active employees visible to the current user:
 * - ADMIN: all active employees
 * - HR: only employees in the same team (via session.user.teamId)
 */
export async function GET() {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isHR = roles.includes("HR");

  if (!isHR && !isAdmin) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const where: Record<string, unknown> = { isActive: true };

  // HR (non-admin) can only see employees in their own team
  if (isHR && !isAdmin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teamId = (session?.user as any)?.teamId as string | null | undefined;
    if (!teamId) {
      // HR not assigned to any team → return empty list
      return NextResponse.json([]);
    }
    where.teamId = teamId;
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      teamId: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json(users);
}
