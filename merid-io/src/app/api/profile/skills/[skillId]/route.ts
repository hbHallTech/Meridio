import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { skillSelfUpdateSchema } from "@/lib/validators";

// ─── PATCH: user updates selfLevel + evidence on own skill ───

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ skillId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { skillId } = await params;

  try {
    // Verify ownership
    const existing = await prisma.skill.findUnique({
      where: { id: skillId },
      select: { userId: true, selfLevel: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Compétence introuvable" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = skillSelfUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const updated = await prisma.skill.update({
      where: { id: skillId },
      data: {
        selfLevel: parsed.data.selfLevel,
        evidence: parsed.data.evidence || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "SKILL_SELF_ASSESSED",
        entityType: "Skill",
        entityId: skillId,
        oldValue: { selfLevel: existing.selfLevel },
        newValue: { selfLevel: parsed.data.selfLevel },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/profile/skills/[skillId] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    );
  }
}

// ─── DELETE: user removes own skill ───

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ skillId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { skillId } = await params;

  const existing = await prisma.skill.findUnique({
    where: { id: skillId },
    select: { userId: true, name: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Compétence introuvable" }, { status: 404 });
  }
  if (existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  await prisma.skill.delete({ where: { id: skillId } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "SKILL_DELETED",
      entityType: "Skill",
      entityId: skillId,
      oldValue: { name: existing.name },
    },
  });

  return NextResponse.json({ success: true });
}
