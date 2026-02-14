import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const closures = await prisma.companyClosure.findMany({
    include: {
      office: { select: { id: true, name: true } },
    },
    orderBy: [{ startDate: "desc" }],
  });

  return NextResponse.json(closures);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();

    const { officeId, startDate, endDate, reason_fr, reason_en } = body;

    if (!officeId || !startDate || !endDate || !reason_fr) {
      return NextResponse.json({ error: "Champs requis manquants (officeId, startDate, endDate, reason_fr)" }, { status: 400 });
    }

    // Compute year from startDate
    const year = new Date(startDate).getFullYear();

    const closure = await prisma.companyClosure.create({
      data: {
        officeId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason_fr,
        reason_en: reason_en || null,
        year,
      },
      include: {
        office: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(closure, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/closures error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, officeId, startDate, endDate, reason_fr, reason_en } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    // Compute year from startDate
    const year = new Date(startDate).getFullYear();

    const closure = await prisma.companyClosure.update({
      where: { id },
      data: {
        officeId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason_fr,
        reason_en: reason_en || null,
        year,
      },
      include: {
        office: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(closure);
  } catch (error) {
    console.error("PATCH /api/admin/closures error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    await prisma.companyClosure.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/closures error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
