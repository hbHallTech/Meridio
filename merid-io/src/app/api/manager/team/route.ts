import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function requireManagerOrAdmin(roles: string[]): boolean {
  return roles.some((r) => ["MANAGER", "ADMIN", "SUPER_ADMIN"].includes(r));
}

// ─── GET: list team members with skills & objectives ───

export async function GET() {
  const session = await auth();
  if (
    !session?.user?.id ||
    !session.user.roles ||
    !requireManagerOrAdmin(session.user.roles as string[])
  ) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  // Find teams managed by current user
  const managedTeams = await prisma.team.findMany({
    where: { managerId: session.user.id },
    select: { id: true, name: true },
  });

  const teamIds = managedTeams.map((t) => t.id);

  if (teamIds.length === 0) {
    return NextResponse.json({ teams: [], members: [] });
  }

  // Fetch all members with their skills and objectives
  const members = await prisma.user.findMany({
    where: { teamId: { in: teamIds }, isActive: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      profilePictureUrl: true,
      jobFunction: true,
      teamId: true,
      skills: {
        orderBy: [{ type: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          type: true,
          selfLevel: true,
          managerLevel: true,
          description: true,
          evidence: true,
          updatedAt: true,
        },
      },
      objectives: {
        orderBy: { deadline: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          deadline: true,
          status: true,
          progress: true,
          selfComment: true,
          managerComment: true,
          managerId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  return NextResponse.json({
    teams: managedTeams,
    members: members.filter((m) => m.id !== session.user!.id),
  });
}
