import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userPersonalSchema } from "@/lib/validators";

// ─── GET: user profile with balances ───

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      profilePictureUrl: true,
      language: true,
      hireDate: true,
      roles: true,
      officeId: true,
      teamId: true,
      office: { select: { id: true, name: true, city: true, country: true } },
      team: { select: { id: true, name: true } },
      // Personal info
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
      // Professional info
      professionalPhone: true,
      internalNumber: true,
      service: true,
      jobFunction: true,
      arrivalDate: true,
      departureDate: true,
      accountingCode: true,
      // Emergency contacts
      emergencyContacts: {
        orderBy: { priority: "asc" },
        select: {
          id: true,
          priority: true,
          firstName: true,
          lastName: true,
          relationship: true,
          phone: true,
          email: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const currentYear = new Date().getFullYear();
  const balances = await prisma.leaveBalance.findMany({
    where: { userId: session.user.id, year: currentYear },
    orderBy: { balanceType: "asc" },
  });

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePictureUrl: user.profilePictureUrl,
      language: user.language,
      hireDate: user.hireDate,
      roles: user.roles,
      office: user.office,
      team: user.team,
      // Personal
      personalEmail: user.personalEmail,
      personalPhone: user.personalPhone,
      personalMobile: user.personalMobile,
      personalAddressStreet: user.personalAddressStreet,
      personalAddressZip: user.personalAddressZip,
      personalAddressCity: user.personalAddressCity,
      personalAddressCountry: user.personalAddressCountry,
      birthDate: user.birthDate,
      birthCity: user.birthCity,
      birthCountry: user.birthCountry,
      nationality: user.nationality,
      gender: user.gender,
      maritalStatus: user.maritalStatus,
      dependentsCount: user.dependentsCount,
      // Professional
      professionalPhone: user.professionalPhone,
      internalNumber: user.internalNumber,
      service: user.service,
      jobFunction: user.jobFunction,
      arrivalDate: user.arrivalDate,
      departureDate: user.departureDate,
      accountingCode: user.accountingCode,
      // Emergency contacts
      emergencyContacts: user.emergencyContacts,
    },
    balances: balances.map((b) => ({
      balanceType: b.balanceType,
      year: b.year,
      totalDays: b.totalDays,
      usedDays: b.usedDays,
      pendingDays: b.pendingDays,
      carriedOverDays: b.carriedOverDays,
      remaining: b.totalDays + b.carriedOverDays - b.usedDays - b.pendingDays,
    })),
  });
}

// ─── PATCH: update language, theme, or personal info ───

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();
  const { language, theme, personal } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  if (language) {
    if (!["fr", "en"].includes(language)) {
      return NextResponse.json({ error: "Langue invalide" }, { status: 400 });
    }
    updateData.language = language;
  }

  if (theme) {
    if (!["light", "dark", "system"].includes(theme)) {
      return NextResponse.json({ error: "Thème invalide" }, { status: 400 });
    }
    updateData.theme = theme;
  }

  // Personal info update (self-service)
  if (personal) {
    const parsed = userPersonalSchema.safeParse(personal);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données personnelles invalides", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const p = parsed.data;
    if (p.personalEmail !== undefined) updateData.personalEmail = p.personalEmail || null;
    if (p.personalPhone !== undefined) updateData.personalPhone = p.personalPhone || null;
    if (p.personalMobile !== undefined) updateData.personalMobile = p.personalMobile || null;
    if (p.personalAddressStreet !== undefined) updateData.personalAddressStreet = p.personalAddressStreet || null;
    if (p.personalAddressZip !== undefined) updateData.personalAddressZip = p.personalAddressZip || null;
    if (p.personalAddressCity !== undefined) updateData.personalAddressCity = p.personalAddressCity || null;
    if (p.personalAddressCountry !== undefined) updateData.personalAddressCountry = p.personalAddressCountry || null;
    if (p.birthDate !== undefined) updateData.birthDate = p.birthDate ? new Date(p.birthDate) : null;
    if (p.birthCity !== undefined) updateData.birthCity = p.birthCity || null;
    if (p.birthCountry !== undefined) updateData.birthCountry = p.birthCountry || null;
    if (p.nationality !== undefined) updateData.nationality = p.nationality || null;
    if (p.gender !== undefined) updateData.gender = p.gender || null;
    if (p.maritalStatus !== undefined) updateData.maritalStatus = p.maritalStatus || null;
    if (p.dependentsCount !== undefined) updateData.dependentsCount = p.dependentsCount;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
  });

  return NextResponse.json({ success: true });
}
