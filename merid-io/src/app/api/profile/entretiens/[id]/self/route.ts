import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyEntretienSelfSubmitted } from "@/lib/notifications";

/**
 * PATCH /api/profile/entretiens/[id]/self
 * Employee submits/updates their self-evaluation.
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
    if (entretien.userId !== session.user.id) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }
    if (entretien.status !== "DRAFT_EMPLOYEE") {
      return NextResponse.json(
        { error: "L'auto-évaluation n'est plus modifiable à ce stade." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { selfSkills, selfObjectives, selfStrengths, selfImprovements, submit } = body;

    const data: Record<string, unknown> = {};
    if (selfSkills !== undefined) data.selfSkills = selfSkills;
    if (selfObjectives !== undefined) data.selfObjectives = selfObjectives;
    if (selfStrengths !== undefined) data.selfStrengths = selfStrengths;
    if (selfImprovements !== undefined) data.selfImprovements = selfImprovements;

    // If employee submits, move to DRAFT_MANAGER
    if (submit) {
      data.status = "DRAFT_MANAGER";
    }

    const updated = await prisma.entretien.update({
      where: { id },
      data,
    });

    // Notify manager when employee submits (non-blocking)
    if (submit) {
      const employee = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { firstName: true, lastName: true },
      });
      const employeeName = employee
        ? `${employee.firstName} ${employee.lastName}`
        : "Un employe";

      void notifyEntretienSelfSubmitted(entretien.managerId, {
        entretienId: id,
        year: entretien.year,
        employeeName,
      }).catch((err) => {
        console.error("[profile/entretiens/self] notification error:", err);
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[profile/entretiens/self] PATCH error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
