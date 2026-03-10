import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { objectiveManagerUpdateSchema } from "@/lib/validators";

type RouteParams = { params: Promise<{ userId: string; objectiveId: string }> };

// ─── PATCH: Manager updates objective (status, progress, comment, etc.) ───

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { userId, objectiveId } = await params;
  const hasAccess = await checkAccessToUser(session.user.id, session.user.roles ?? [], userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const existing = await prisma.objective.findUnique({
      where: { id: objectiveId },
      select: { userId: true, status: true, progress: true },
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Objectif introuvable" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = objectiveManagerUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message, details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.deadline !== undefined) updateData.deadline = new Date(data.deadline);
    if (data.status !== undefined) updateData.status = data.status;
    if (data.progress !== undefined) updateData.progress = data.progress;
    if (data.managerComment !== undefined) updateData.managerComment = data.managerComment || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 });
    }

    const updated = await prisma.objective.update({
      where: { id: objectiveId },
      data: updateData,
      select: {
        id: true,
        title: true,
        description: true,
        deadline: true,
        status: true,
        progress: true,
        selfComment: true,
        managerComment: true,
        updatedAt: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "OBJECTIVE_UPDATED",
        entityType: "Objective",
        entityId: objectiveId,
        oldValue: { status: existing.status, progress: existing.progress },
        newValue: {
          status: data.status ?? existing.status,
          progress: data.progress ?? existing.progress,
          forUserId: userId,
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/users/[userId]/objectives/[objectiveId] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'objectif" },
      { status: 500 }
    );
  }
}

// ─── DELETE: Manager/HR cancels an objective (soft-delete via CANCELLED) ───

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { userId, objectiveId } = await params;
  const hasAccess = await checkAccessToUser(session.user.id, session.user.roles ?? [], userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const existing = await prisma.objective.findUnique({
      where: { id: objectiveId },
      select: { userId: true, title: true, status: true },
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Objectif introuvable" }, { status: 404 });
    }

    // Soft-delete: mark as CANCELLED
    await prisma.objective.update({
      where: { id: objectiveId },
      data: { status: "CANCELLED" },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "OBJECTIVE_CANCELLED",
        entityType: "Objective",
        entityId: objectiveId,
        oldValue: { status: existing.status, title: existing.title },
        newValue: { status: "CANCELLED", forUserId: userId },
      },
    });

    return NextResponse.json({ success: true, status: "CANCELLED" });
  } catch (error) {
    console.error("DELETE /api/users/[userId]/objectives/[objectiveId] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'annulation de l'objectif" },
      { status: 500 }
    );
  }
}

async function checkAccessToUser(
  currentUserId: string,
  roles: string[],
  targetUserId: string
): Promise<boolean> {
  const isHr = roles.includes("HR") || roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
  if (isHr) return true;
  if (!roles.includes("MANAGER")) return false;

  const team = await prisma.team.findFirst({
    where: {
      managerId: currentUserId,
      members: { some: { id: targetUserId } },
    },
    select: { id: true },
  });
  return !!team;
}
