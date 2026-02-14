import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { delegationSchema } from "@/lib/validators";

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const delegations = await prisma.delegation.findMany({
    include: {
      fromUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      toUser: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(delegations);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();

    const parsed = delegationSchema.parse(body);

    if (parsed.fromUserId === parsed.toUserId) {
      return NextResponse.json(
        { error: "Le délégant et le délégataire doivent être différents" },
        { status: 400 }
      );
    }

    const delegation = await prisma.delegation.create({
      data: {
        fromUserId: parsed.fromUserId,
        toUserId: parsed.toUserId,
        startDate: new Date(parsed.startDate),
        endDate: new Date(parsed.endDate),
        createdBy: "ADMIN",
        isActive: true,
      },
      include: {
        fromUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        toUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: "DELEGATION_CREATED",
        entityType: "Delegation",
        entityId: delegation.id,
        newValue: {
          fromUserId: parsed.fromUserId,
          toUserId: parsed.toUserId,
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          createdBy: "ADMIN",
        },
      },
    });

    return NextResponse.json(delegation, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Données invalides", details: error }, { status: 400 });
    }
    console.error("POST /api/admin/delegations error:", error);
    return NextResponse.json({ error: "Erreur lors de la création de la délégation" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, startDate, endDate, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "L'identifiant de la délégation est requis" }, { status: 400 });
    }

    const existing = await prisma.delegation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Délégation introuvable" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = new Date(endDate);
    if (isActive !== undefined) updateData.isActive = isActive;

    const oldValue = {
      startDate: existing.startDate,
      endDate: existing.endDate,
      isActive: existing.isActive,
    };

    const delegation = await prisma.delegation.update({
      where: { id },
      data: updateData,
      include: {
        fromUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        toUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: isActive === false ? "DELEGATION_REVOKED" : "DELEGATION_CREATED",
        entityType: "Delegation",
        entityId: id,
        oldValue,
        newValue: updateData as Record<string, string | number | boolean | Date>,
      },
    });

    return NextResponse.json(delegation);
  } catch (error) {
    console.error("PATCH /api/admin/delegations error:", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour de la délégation" }, { status: 500 });
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
      return NextResponse.json({ error: "L'identifiant de la délégation est requis" }, { status: 400 });
    }

    const existing = await prisma.delegation.findUnique({
      where: { id },
      include: {
        fromUser: { select: { firstName: true, lastName: true } },
        toUser: { select: { firstName: true, lastName: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Délégation introuvable" }, { status: 404 });
    }

    await prisma.delegation.delete({ where: { id } });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: "DELEGATION_REVOKED",
        entityType: "Delegation",
        entityId: id,
        oldValue: {
          fromUserId: existing.fromUserId,
          toUserId: existing.toUserId,
          startDate: existing.startDate,
          endDate: existing.endDate,
          isActive: existing.isActive,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/delegations error:", error);
    return NextResponse.json({ error: "Erreur lors de la suppression de la délégation" }, { status: 500 });
  }
}
