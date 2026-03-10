import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { skillCreateSchema } from "@/lib/validators";

// ─── GET: list all skills for the authenticated user ───

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const skills = await prisma.skill.findMany({
    where: { userId: session.user.id },
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
  });

  return NextResponse.json(skills);
}

// ─── POST: user adds a new skill (self-assessment) ───

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = skillCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message, details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check duplicate (@@unique enforces this at DB level too)
    const existing = await prisma.skill.findUnique({
      where: { userId_name: { userId: session.user.id, name: data.name } },
    });
    if (existing) {
      return NextResponse.json(
        { error: `La compétence "${data.name}" existe déjà dans votre profil` },
        { status: 409 }
      );
    }

    const skill = await prisma.skill.create({
      data: {
        userId: session.user.id,
        name: data.name,
        type: data.type,
        selfLevel: data.selfLevel ?? null,
        description: data.description || null,
        evidence: data.evidence || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "SKILL_CREATED",
        entityType: "Skill",
        entityId: skill.id,
        newValue: { name: data.name, type: data.type },
      },
    });

    return NextResponse.json(skill, { status: 201 });
  } catch (error) {
    console.error("POST /api/profile/skills error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'ajout de la compétence" },
      { status: 500 }
    );
  }
}
