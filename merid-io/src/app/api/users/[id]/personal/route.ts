import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userPersonalSchema } from "@/lib/validators";

// ─── PATCH: HR/Admin updates personal info for a specific user ───

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = session.user.roles ?? [];
  const isHrOrAdmin = (userRoles as string[]).some((r) =>
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
    const parsed = userPersonalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (data.personalEmail !== undefined) updateData.personalEmail = data.personalEmail || null;
    if (data.personalPhone !== undefined) updateData.personalPhone = data.personalPhone || null;
    if (data.personalMobile !== undefined) updateData.personalMobile = data.personalMobile || null;
    if (data.personalAddressStreet !== undefined) updateData.personalAddressStreet = data.personalAddressStreet || null;
    if (data.personalAddressZip !== undefined) updateData.personalAddressZip = data.personalAddressZip || null;
    if (data.personalAddressCity !== undefined) updateData.personalAddressCity = data.personalAddressCity || null;
    if (data.personalAddressCountry !== undefined) updateData.personalAddressCountry = data.personalAddressCountry || null;
    if (data.birthDate !== undefined) updateData.birthDate = data.birthDate ? new Date(data.birthDate) : null;
    if (data.birthCity !== undefined) updateData.birthCity = data.birthCity || null;
    if (data.birthCountry !== undefined) updateData.birthCountry = data.birthCountry || null;
    if (data.nationality !== undefined) updateData.nationality = data.nationality || null;
    if (data.gender !== undefined) updateData.gender = data.gender || null;
    if (data.maritalStatus !== undefined) updateData.maritalStatus = data.maritalStatus || null;
    if (data.dependentsCount !== undefined) updateData.dependentsCount = data.dependentsCount;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        personalEmail: true,
        personalPhone: true,
        personalMobile: true,
        personalAddressStreet: true,
        personalAddressZip: true,
        personalAddressCity: true,
        personalAddressCountry: true,
        birthDate: true,
        birthCity: true,
        birthCountry: true,
        nationality: true,
        gender: true,
        maritalStatus: true,
        dependentsCount: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "USER_PERSONAL_UPDATED",
        entityType: "User",
        entityId: id,
        newValue: { fieldsUpdated: Object.keys(updateData), updatedBy: "HR/ADMIN" },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/users/[id]/personal error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour des informations personnelles" },
      { status: 500 }
    );
  }
}
