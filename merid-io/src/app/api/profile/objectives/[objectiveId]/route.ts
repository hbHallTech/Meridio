import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { objectiveSelfCommentSchema } from "@/lib/validators";

// ─── PATCH: user adds/updates selfComment on own objective ───

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { objectiveId } = await params;

  try {
    const existing = await prisma.objective.findUnique({
      where: { id: objectiveId },
      select: { userId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Objectif introuvable" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = objectiveSelfCommentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const updated = await prisma.objective.update({
      where: { id: objectiveId },
      data: { selfComment: parsed.data.selfComment },
      select: {
        id: true,
        title: true,
        selfComment: true,
        updatedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "OBJECTIVE_SELF_COMMENTED",
        entityType: "Objective",
        entityId: objectiveId,
        newValue: { hasComment: !!parsed.data.selfComment },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/profile/objectives/[objectiveId] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    );
  }
}
