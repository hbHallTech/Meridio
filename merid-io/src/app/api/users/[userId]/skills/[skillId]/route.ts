import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { skillManagerUpdateSchema, skillHrUpdateSchema } from "@/lib/validators";

// ─── PATCH: Manager sets managerLevel / HR edits all fields ───

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
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Compétence introuvable" }, { status: 404 });
    }

    const body = await request.json();

    // HR can update all fields; managers can only update managerLevel
    if (isHr) {
      const parsed = skillHrUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0].message },
          { status: 400 }
        );
      }

      const data: Record<string, unknown> = {};
      if (parsed.data.name !== undefined) data.name = parsed.data.name;
      if (parsed.data.type !== undefined) data.type = parsed.data.type;
      if (parsed.data.selfLevel !== undefined) data.selfLevel = parsed.data.selfLevel;
      if (parsed.data.managerLevel !== undefined) data.managerLevel = parsed.data.managerLevel;
      if (parsed.data.description !== undefined) data.description = parsed.data.description || null;
      if (parsed.data.evidence !== undefined) data.evidence = parsed.data.evidence || null;

      const updated = await prisma.skill.update({
        where: { id: skillId },
        data,
      });

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "SKILL_UPDATED_BY_HR",
          entityType: "Skill",
          entityId: skillId,
          oldValue: { name: existing.name, type: existing.type, selfLevel: existing.selfLevel, managerLevel: existing.managerLevel },
          newValue: { ...data, forUserId: userId },
        },
      });

      return NextResponse.json(updated);
    }

    // Manager path: only managerLevel
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
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    );
  }
}

// ─── DELETE: HR deletes a skill ───

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string; skillId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  const isHr = roles.includes("HR") || roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
  if (!isHr) {
    return NextResponse.json({ error: "Accès réservé aux RH" }, { status: 403 });
  }

  const { userId, skillId } = await params;

  try {
    const existing = await prisma.skill.findUnique({
      where: { id: skillId },
      select: { userId: true, name: true },
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Compétence introuvable" }, { status: 404 });
    }

    await prisma.skill.delete({ where: { id: skillId } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "SKILL_DELETED_BY_HR",
        entityType: "Skill",
        entityId: skillId,
        oldValue: { skillName: existing.name, forUserId: userId },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/users/[userId]/skills/[skillId] error:", error);
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
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
