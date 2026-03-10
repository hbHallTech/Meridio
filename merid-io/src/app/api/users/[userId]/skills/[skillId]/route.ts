import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { skillManagerUpdateSchema } from "@/lib/validators";

// ─── PATCH: Manager sets managerLevel on a team member's skill ───

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string; skillId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { userId, skillId } = await params;
  const roles = session.user.roles ?? [];
  const isHr = roles.includes("HR") || roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");

  if (!isHr) {
    const isManager = await checkIsManagerOf(session.user.id, userId);
    if (!isManager) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }
  }

  try {
    const existing = await prisma.skill.findUnique({
      where: { id: skillId },
      select: { userId: true, managerLevel: true, name: true },
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Compétence introuvable" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = skillManagerUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const updated = await prisma.skill.update({
      where: { id: skillId },
      data: { managerLevel: parsed.data.managerLevel },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "SKILL_MANAGER_ASSESSED",
        entityType: "Skill",
        entityId: skillId,
        oldValue: { managerLevel: existing.managerLevel },
        newValue: { managerLevel: parsed.data.managerLevel, skillName: existing.name, forUserId: userId },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/users/[userId]/skills/[skillId] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'évaluation" },
      { status: 500 }
    );
  }
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
