import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userProfessionalSchema } from "@/lib/validators";

// ─── GET: fetch professional info (HR/ADMIN only) ───

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = session.user.roles ?? [];
  const isHrOrAdmin = userRoles.some((r: string) =>
    ["HR", "ADMIN", "SUPER_ADMIN"].includes(r)
  );

  // Allow self-access or HR/ADMIN
  const { id } = await params;
  if (id !== session.user.id && !isHrOrAdmin) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      professionalPhone: true,
      internalNumber: true,
      service: true,
      jobFunction: true,
      arrivalDate: true,
      departureDate: true,
      accountingCode: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  return NextResponse.json(user);
}

// ─── PATCH: update professional info (HR/ADMIN only) ───

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = session.user.roles ?? [];
  const isHrOrAdmin = userRoles.some((r: string) =>
    ["HR", "ADMIN", "SUPER_ADMIN"].includes(r)
  );

  if (!isHrOrAdmin) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = userProfessionalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (data.professionalPhone !== undefined) updateData.professionalPhone = data.professionalPhone || null;
    if (data.internalNumber !== undefined) updateData.internalNumber = data.internalNumber || null;
    if (data.service !== undefined) updateData.service = data.service || null;
    if (data.jobFunction !== undefined) updateData.jobFunction = data.jobFunction || null;
    if (data.arrivalDate !== undefined) updateData.arrivalDate = data.arrivalDate ? new Date(data.arrivalDate) : null;
    if (data.departureDate !== undefined) updateData.departureDate = data.departureDate ? new Date(data.departureDate) : null;
    if (data.accountingCode !== undefined) updateData.accountingCode = data.accountingCode || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 });
    }

    // Build old values for audit
    const oldValue: Record<string, unknown> = {};
    for (const key of Object.keys(updateData)) {
      oldValue[key] = (existingUser as Record<string, unknown>)[key];
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        professionalPhone: true,
        internalNumber: true,
        service: true,
        jobFunction: true,
        arrivalDate: true,
        departureDate: true,
        accountingCode: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "USER_PROFESSIONAL_UPDATED",
        entityType: "User",
        entityId: id,
        oldValue: JSON.parse(JSON.stringify(oldValue)),
        newValue: JSON.parse(JSON.stringify(updateData)),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/users/[id]/professional error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour des informations professionnelles" },
      { status: 500 }
    );
  }
}
