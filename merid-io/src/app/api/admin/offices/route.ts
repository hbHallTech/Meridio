import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { officeSchema } from "@/lib/validators";
import { logAudit, getIp } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const offices = await prisma.office.findMany({
    include: {
      company: { select: { name: true } },
      _count: { select: { users: true, teams: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(offices);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Parse numeric fields from strings if needed
    const parsed = officeSchema.parse({
      ...body,
      defaultAnnualLeave: Number(body.defaultAnnualLeave),
      defaultOfferedDays: Number(body.defaultOfferedDays),
      minNoticeDays: Number(body.minNoticeDays),
      maxCarryOverDays: Number(body.maxCarryOverDays),
      probationMonths: Number(body.probationMonths),
      sickLeaveJustifFromDay: Number(body.sickLeaveJustifFromDay),
    });

    const office = await prisma.office.create({
      data: parsed,
      include: {
        company: { select: { name: true } },
        _count: { select: { users: true, teams: true } },
      },
    });

    logAudit(session.user.id, "OFFICE_CREATED", {
      entityType: "Office",
      entityId: office.id,
      ip: getIp(request.headers),
      newValue: { name: parsed.name },
    });

    return NextResponse.json(office, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Données invalides", details: error }, { status: 400 });
    }
    return NextResponse.json({ error: "Erreur lors de la création du bureau" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, ...rest } = body;

    if (!id) {
      return NextResponse.json({ error: "L'identifiant du bureau est requis" }, { status: 400 });
    }

    // Parse numeric fields from strings if needed
    const parsed = officeSchema.parse({
      ...rest,
      defaultAnnualLeave: Number(rest.defaultAnnualLeave),
      defaultOfferedDays: Number(rest.defaultOfferedDays),
      minNoticeDays: Number(rest.minNoticeDays),
      maxCarryOverDays: Number(rest.maxCarryOverDays),
      probationMonths: Number(rest.probationMonths),
      sickLeaveJustifFromDay: Number(rest.sickLeaveJustifFromDay),
    });

    const office = await prisma.office.update({
      where: { id },
      data: parsed,
      include: {
        company: { select: { name: true } },
        _count: { select: { users: true, teams: true } },
      },
    });

    logAudit(session.user.id, "OFFICE_UPDATED", {
      entityType: "Office",
      entityId: id,
      ip: getIp(request.headers),
      newValue: { name: parsed.name },
    });

    return NextResponse.json(office);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Données invalides", details: error }, { status: 400 });
    }
    return NextResponse.json({ error: "Erreur lors de la mise à jour du bureau" }, { status: 500 });
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
      return NextResponse.json({ error: "L'identifiant du bureau est requis" }, { status: 400 });
    }

    // Check if the office has linked users or teams
    const office = await prisma.office.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, teams: true } },
      },
    });

    if (!office) {
      return NextResponse.json({ error: "Bureau introuvable" }, { status: 404 });
    }

    if (office._count.users > 0 || office._count.teams > 0) {
      return NextResponse.json(
        {
          error: `Impossible de supprimer ce bureau. Il est lié à ${office._count.users} utilisateur(s) et ${office._count.teams} équipe(s).`,
        },
        { status: 400 }
      );
    }

    await prisma.office.delete({ where: { id } });

    logAudit(session.user.id, "OFFICE_DELETED", {
      entityType: "Office",
      entityId: id,
      ip: getIp(request.headers),
      oldValue: { name: office.name },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erreur lors de la suppression du bureau" }, { status: 500 });
  }
}
