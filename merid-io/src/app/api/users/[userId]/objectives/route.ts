import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { objectiveCreateSchema } from "@/lib/validators";

// ─── GET: Manager/HR views objectives of a team member ───

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { userId } = await params;
  const hasAccess = await checkAccessToUser(session.user.id, session.user.roles ?? [], userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const objectives = await prisma.objective.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { deadline: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      deadline: true,
      status: true,
      progress: true,
      selfComment: true,
      managerComment: true,
      createdAt: true,
      updatedAt: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(objectives);
}

// ─── POST: Manager/HR assigns a new objective to a team member ───

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { userId } = await params;
  const hasAccess = await checkAccessToUser(session.user.id, session.user.roles ?? [], userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  // Prevent assigning objectives to oneself
  if (userId === session.user.id) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas vous assigner un objectif à vous-même" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const parsed = objectiveCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message, details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const objective = await prisma.objective.create({
      data: {
        userId,
        managerId: session.user.id,
        title: data.title,
        description: data.description,
        deadline: new Date(data.deadline),
        status: (data.status as "IN_PROGRESS" | "ACHIEVED" | "PARTIALLY_ACHIEVED" | "NOT_ACHIEVED" | "CANCELLED") ?? "IN_PROGRESS",
        progress: data.progress ?? 0,
      },
      select: {
        id: true,
        title: true,
        description: true,
        deadline: true,
        status: true,
        progress: true,
        createdAt: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "OBJECTIVE_CREATED",
        entityType: "Objective",
        entityId: objective.id,
        newValue: { title: data.title, forUserId: userId },
      },
    });

    return NextResponse.json(objective, { status: 201 });
  } catch (error) {
    console.error("POST /api/users/[userId]/objectives error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'objectif" },
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
