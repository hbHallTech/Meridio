import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/profile/entretiens
 * List all entretiens for the current user.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const entretiens = await prisma.entretien.findMany({
      where: { userId: session.user.id },
      orderBy: { year: "desc" },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(entretiens);
  } catch (err) {
    console.error("[profile/entretiens] GET error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

/**
 * POST /api/profile/entretiens
 * Create an entretien for the current year.
 * Auto-fills selfSkills and selfObjectives from current data.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const year = new Date().getFullYear();

    // Check if already exists
    const existing = await prisma.entretien.findUnique({
      where: { userId_year: { userId: session.user.id, year } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Un entretien existe déjà pour cette année.", entretien: existing },
        { status: 409 }
      );
    }

    // Find user's manager via team
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        teamId: true,
        team: { select: { managerId: true } },
      },
    });

    const managerId = user?.team?.managerId;
    if (!managerId) {
      return NextResponse.json(
        { error: "Vous n'avez pas de manager assigné. Contactez votre administrateur." },
        { status: 400 }
      );
    }

    // Pre-fill from current skills and objectives
    const skills = await prisma.skill.findMany({
      where: { userId: session.user.id },
      select: { id: true, name: true, type: true, selfLevel: true },
    });

    const objectives = await prisma.objective.findMany({
      where: { userId: session.user.id },
      select: { id: true, title: true, status: true, progress: true, selfComment: true },
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
        userId: session.user.id,
        managerId,
        year,
        status: "DRAFT_EMPLOYEE",
        selfSkills,
        selfObjectives,
      },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(entretien, { status: 201 });
  } catch (err) {
    console.error("[profile/entretiens] POST error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
