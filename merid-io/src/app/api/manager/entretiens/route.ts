import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyEntretienCreated } from "@/lib/notifications";

/**
 * GET /api/manager/entretiens?year=2026
 * List entretiens for all managed team members.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const yearParam = request.nextUrl.searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    const entretiens = await prisma.entretien.findMany({
      where: {
        managerId: session.user.id,
        year,
      },
      orderBy: { updatedAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePictureUrl: true,
          },
        },
      },
    });

    return NextResponse.json(entretiens);
  } catch (err) {
    console.error("[manager/entretiens] GET error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

/**
 * POST /api/manager/entretiens
 * Manager creates an entretien for a team member.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { userId } = body;
    if (!userId) {
      return NextResponse.json({ error: "userId requis" }, { status: 400 });
    }

    // Verify manager manages this user
    const team = await prisma.team.findFirst({
      where: {
        managerId: session.user.id,
        members: { some: { id: userId } },
      },
    });
    if (!team) {
      return NextResponse.json(
        { error: "Cet employé n'est pas dans votre équipe." },
        { status: 403 }
      );
    }

    const year = new Date().getFullYear();

    const existing = await prisma.entretien.findUnique({
      where: { userId_year: { userId, year } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Un entretien existe déjà pour cet employé cette année.", entretien: existing },
        { status: 409 }
      );
    }

    // Pre-fill from current skills and objectives
    const skills = await prisma.skill.findMany({
      where: { userId },
      select: { id: true, name: true, type: true, selfLevel: true, managerLevel: true },
    });
    const objectives = await prisma.objective.findMany({
      where: { userId },
      select: { id: true, title: true, status: true, progress: true, selfComment: true, managerComment: true },
    });

    const selfSkills = skills.map((s) => ({
      skillId: s.id,
      skillName: s.name,
      type: s.type,
      selfLevel: s.selfLevel || null,
      comment: "",
    }));
    const selfObjectives = objectives.map((o) => ({
      objectiveId: o.id,
      title: o.title,
      status: o.status,
      selfProgress: o.progress ?? 0,
      selfComment: o.selfComment || "",
    }));

    const entretien = await prisma.entretien.create({
      data: {
        userId,
        managerId: session.user.id,
        year,
        status: "DRAFT_EMPLOYEE",
        selfSkills,
        selfObjectives,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Notify employee (non-blocking)
    const managerUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { firstName: true, lastName: true },
    });
    const managerName = managerUser
      ? `${managerUser.firstName} ${managerUser.lastName}`
      : "Votre manager";

    void notifyEntretienCreated(userId, {
      entretienId: entretien.id,
      year,
      managerName,
    }).catch((err) => {
      console.error("[manager/entretiens] notification error:", err);
    });

    return NextResponse.json(entretien, { status: 201 });
  } catch (err) {
    console.error("[manager/entretiens] POST error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
