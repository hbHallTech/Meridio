import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const rules = await prisma.exceptionalLeaveRule.findMany({
    include: {
      office: { select: { id: true, name: true } },
    },
    orderBy: [{ officeId: "asc" }, { reason_fr: "asc" }],
  });

  return NextResponse.json(rules);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { officeId, reason_fr, reason_en, maxDays, isActive } = body;

    if (!officeId || !reason_fr || !reason_en || maxDays === undefined) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }

    const rule = await prisma.exceptionalLeaveRule.create({
      data: {
        officeId,
        reason_fr,
        reason_en,
        maxDays: Number(maxDays),
        isActive: isActive ?? true,
      },
      include: {
        office: { select: { id: true, name: true } },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: "OFFICE_UPDATED",
        entityType: "ExceptionalLeaveRule",
        entityId: rule.id,
        newValue: { officeId, reason_fr, reason_en, maxDays, isActive: isActive ?? true },
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/exceptional-rules error:", error);
    return NextResponse.json({ error: "Erreur lors de la création de la règle" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, officeId, reason_fr, reason_en, maxDays, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "L'identifiant de la règle est requis" }, { status: 400 });
    }

    const existing = await prisma.exceptionalLeaveRule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Règle introuvable" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (officeId !== undefined) updateData.officeId = officeId;
    if (reason_fr !== undefined) updateData.reason_fr = reason_fr;
    if (reason_en !== undefined) updateData.reason_en = reason_en;
    if (maxDays !== undefined) updateData.maxDays = Number(maxDays);
    if (isActive !== undefined) updateData.isActive = isActive;

    const oldValue = {
      officeId: existing.officeId,
      reason_fr: existing.reason_fr,
      reason_en: existing.reason_en,
      maxDays: existing.maxDays,
      isActive: existing.isActive,
    };

    const rule = await prisma.exceptionalLeaveRule.update({
      where: { id },
      data: updateData,
      include: {
        office: { select: { id: true, name: true } },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: "OFFICE_UPDATED",
        entityType: "ExceptionalLeaveRule",
        entityId: id,
        oldValue,
        newValue: updateData as Record<string, string | number | boolean>,
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    console.error("PATCH /api/admin/exceptional-rules error:", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour de la règle" }, { status: 500 });
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
      return NextResponse.json({ error: "L'identifiant de la règle est requis" }, { status: 400 });
    }

    const existing = await prisma.exceptionalLeaveRule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Règle introuvable" }, { status: 404 });
    }

    await prisma.exceptionalLeaveRule.delete({ where: { id } });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: "OFFICE_UPDATED",
        entityType: "ExceptionalLeaveRule",
        entityId: id,
        oldValue: {
          officeId: existing.officeId,
          reason_fr: existing.reason_fr,
          reason_en: existing.reason_en,
          maxDays: existing.maxDays,
          isActive: existing.isActive,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/exceptional-rules error:", error);
    return NextResponse.json({ error: "Erreur lors de la suppression de la règle" }, { status: 500 });
  }
}
