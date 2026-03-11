import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/manager/entretiens/[id]/complete
 * Manager marks the entretien as COMPLETED after both sides have evaluated.
 * Optionally adds a finalComment.
 */
export async function POST(
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
        { error: "L'entretien ne peut pas être complété à ce stade." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { finalComment } = body as { finalComment?: string };

    const updated = await prisma.entretien.update({
      where: { id },
      data: {
        status: "COMPLETED",
        ...(finalComment ? { finalComment } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[manager/entretiens/complete] POST error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
