import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ─── GET: Manager/HR views skills of a team member ───

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { userId } = await params;
  const roles = session.user.roles ?? [];
  const isHr = roles.includes("HR") || roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");

  // If not HR, check if manager of this user's team
  if (!isHr) {
    const isManager = await checkIsManagerOf(session.user.id, userId);
    if (!isManager) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }
  }

  const skills = await prisma.skill.findMany({
    where: { userId },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(skills);
}

async function checkIsManagerOf(managerId: string, userId: string): Promise<boolean> {
  const team = await prisma.team.findFirst({
    where: {
      managerId,
      members: { some: { id: userId } },
    },
    select: { id: true },
  });
  return !!team;
}
