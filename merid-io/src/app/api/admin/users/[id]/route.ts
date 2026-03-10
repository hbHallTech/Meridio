import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isHrOrAdmin(roles: string[]): boolean {
  return roles.some((r) => ["HR", "ADMIN", "SUPER_ADMIN"].includes(r));
}

// ─── GET: fetch a single user with all details ───

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles || !isHrOrAdmin(session.user.roles as string[])) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      cin: true,
      cnss: true,
      roles: true,
      isActive: true,
      hireDate: true,
      language: true,
      forcePasswordChange: true,
      profilePictureUrl: true,
      createdAt: true,
      officeId: true,
      teamId: true,
      office: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      // Personal
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
      // Professional
      professionalPhone: true,
      internalNumber: true,
      service: true,
      jobFunction: true,
      arrivalDate: true,
      departureDate: true,
      accountingCode: true,
      // Relations
      emergencyContacts: {
        orderBy: { priority: "asc" },
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
      },
      skills: {
        orderBy: [{ type: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          type: true,
          selfLevel: true,
          managerLevel: true,
          description: true,
          evidence: true,
          updatedAt: true,
        },
      },
      contracts: {
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          type: true,
          status: true,
          contractNumber: true,
          startDate: true,
          endDate: true,
          trialPeriodEnd: true,
          weeklyHours: true,
          salaryGrossMonthly: true,
          currency: true,
          jobTitle: true,
          department: true,
          location: true,
          remoteAllowed: true,
          remotePercentage: true,
          notes: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  return NextResponse.json(user);
}
