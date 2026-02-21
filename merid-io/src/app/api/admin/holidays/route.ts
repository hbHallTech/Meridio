import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, getIp } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const year = searchParams.get("year");

  const where = year
    ? {
        date: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${Number(year) + 1}-01-01`),
        },
      }
    : {};

  const holidays = await prisma.publicHoliday.findMany({
    where,
    include: {
      office: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "asc" }],
  });

  return NextResponse.json(holidays);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();

    const { officeId, date, name_fr, name_en, type } = body;

    if (!officeId || !date || !name_fr || !type) {
      return NextResponse.json({ error: "Champs requis manquants (officeId, date, name_fr, type)" }, { status: 400 });
    }

    const holiday = await prisma.publicHoliday.create({
      data: {
        officeId,
        date: new Date(date),
        name_fr,
        name_en: name_en || null,
        type,
      },
      include: {
        office: { select: { id: true, name: true } },
      },
    });

    logAudit(session.user.id, "HOLIDAY_CREATED", {
      entityType: "PublicHoliday",
      entityId: holiday.id,
      ip: getIp(request.headers),
      newValue: { name_fr, date, officeId },
    });

    return NextResponse.json(holiday, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Un jour férié existe déjà à cette date pour ce bureau" }, { status: 409 });
    }
    console.error("POST /api/admin/holidays error:", error);
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
    const { id, officeId, date, name_fr, name_en, type } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    const holiday = await prisma.publicHoliday.update({
      where: { id },
      data: {
        officeId,
        date: new Date(date),
        name_fr,
        name_en: name_en || null,
        type,
      },
      include: {
        office: { select: { id: true, name: true } },
      },
    });

    logAudit(session.user.id, "HOLIDAY_UPDATED", {
      entityType: "PublicHoliday",
      entityId: id,
      ip: getIp(request.headers),
      newValue: { name_fr, date, officeId },
    });

    return NextResponse.json(holiday);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Un jour férié existe déjà à cette date pour ce bureau" }, { status: 409 });
    }
    console.error("PATCH /api/admin/holidays error:", error);
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

    await prisma.publicHoliday.delete({ where: { id } });

    logAudit(session.user.id, "HOLIDAY_DELETED", {
      entityType: "PublicHoliday",
      entityId: id,
      ip: getIp(request.headers),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/holidays error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
