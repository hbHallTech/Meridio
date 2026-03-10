import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emergencyContactSchema } from "@/lib/validators";

// ─── PATCH: update an emergency contact (ownership verified) ───

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify ownership
    const existing = await prisma.emergencyContact.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Contact introuvable" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = emergencyContactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message, details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Check priority uniqueness (excluding current contact)
    const existingPriority = await prisma.emergencyContact.findFirst({
      where: {
        userId: session.user.id,
        priority: parsed.data.priority,
        id: { not: id },
      },
    });
    if (existingPriority) {
      return NextResponse.json(
        { error: `Un contact avec la priorité ${parsed.data.priority} existe déjà` },
        { status: 409 }
      );
    }

    const updated = await prisma.emergencyContact.update({
      where: { id },
      data: {
        priority: parsed.data.priority,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        relation: parsed.data.relation,
        phone: parsed.data.phone,
        mobile: parsed.data.mobile || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
      },
      select: {
        id: true,
        priority: true,
        firstName: true,
        lastName: true,
        relation: true,
        phone: true,
        mobile: true,
        email: true,
        address: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "EMERGENCY_CONTACT_UPDATED",
        entityType: "EmergencyContact",
        entityId: id,
        newValue: { firstName: updated.firstName, lastName: updated.lastName, relation: updated.relation },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/profile/emergency-contacts/[id] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du contact d'urgence" },
      { status: 500 }
    );
  }
}

// ─── DELETE: remove an emergency contact (ownership verified) ───

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify ownership
    const existing = await prisma.emergencyContact.findUnique({
      where: { id },
      select: { userId: true, firstName: true, lastName: true, relation: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Contact introuvable" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    await prisma.emergencyContact.delete({ where: { id } });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "EMERGENCY_CONTACT_DELETED",
        entityType: "EmergencyContact",
        entityId: id,
        oldValue: { firstName: existing.firstName, lastName: existing.lastName, relation: existing.relation },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/profile/emergency-contacts/[id] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du contact d'urgence" },
      { status: 500 }
    );
  }
}
