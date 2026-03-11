import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/manager/entretiens/[id]/evaluate
 * Manager fills their evaluation (skills + objectives + comments).
 * Only allowed when status is DRAFT_MANAGER (employee has submitted).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;

    const entretien = await prisma.entretien.findUnique({ where: { id } });
    if (!entretien) {
      return NextResponse.json({ error: "Entretien introuvable" }, { status: 404 });
    }
    if (entretien.managerId !== session.user.id) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }
    if (entretien.status !== "DRAFT_MANAGER") {
      return NextResponse.json(
        { error: "L'employé n'a pas encore soumis son auto-évaluation." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { managerSkills, managerObjectives, managerStrengths, managerImprovements } = body;

    const data: Record<string, unknown> = {};
    if (managerSkills !== undefined) data.managerSkills = managerSkills;
    if (managerObjectives !== undefined) data.managerObjectives = managerObjectives;
    if (managerStrengths !== undefined) data.managerStrengths = managerStrengths;
    if (managerImprovements !== undefined) data.managerImprovements = managerImprovements;

    const updated = await prisma.entretien.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[manager/entretiens/evaluate] PATCH error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
