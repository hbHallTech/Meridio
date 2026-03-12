import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { skillCreateSchema } from "@/lib/validators";

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

// ─── POST: HR creates a skill for a user ───

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
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

  const { userId } = await params;

  try {
    const body = await request.json();
    const parsed = skillCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const skill = await prisma.skill.create({
      data: {
        userId,
        name: parsed.data.name,
        type: parsed.data.type,
        selfLevel: parsed.data.selfLevel ?? null,
        description: parsed.data.description || null,
        evidence: parsed.data.evidence || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "SKILL_CREATED_BY_HR",
        entityType: "Skill",
        entityId: skill.id,
        newValue: { skillName: parsed.data.name, forUserId: userId },
      },
    });

    return NextResponse.json(skill, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Cette compétence existe déjà pour cet utilisateur" },
        { status: 409 }
      );
    }
    console.error("POST /api/users/[userId]/skills error:", error);
    return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 });
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
