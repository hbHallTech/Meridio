import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

// GET — List all offices
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "admin:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const offices = await prisma.office.findMany({
    include: {
      _count: { select: { users: true, teams: true } },
      company: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ offices });
}

// POST — Create a new office
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "admin:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  const {
    name,
    country,
    city,
    companyId,
    defaultAnnualLeave,
    defaultOfferedDays,
    minNoticeDays,
    maxCarryOverDays,
    carryOverDeadline,
    probationMonths,
    sickLeaveJustifFromDay,
    workingDays,
  } = body;

  if (!name?.trim() || !country?.trim() || !city?.trim() || !companyId) {
    return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
  }

  const office = await prisma.office.create({
    data: {
      name: name.trim(),
      country: country.trim(),
      city: city.trim(),
      companyId,
      defaultAnnualLeave: defaultAnnualLeave ?? 25,
      defaultOfferedDays: defaultOfferedDays ?? 0,
      minNoticeDays: minNoticeDays ?? 2,
      maxCarryOverDays: maxCarryOverDays ?? 10,
      carryOverDeadline: carryOverDeadline ?? "03-31",
      probationMonths: probationMonths ?? 3,
      sickLeaveJustifFromDay: sickLeaveJustifFromDay ?? 2,
      workingDays: workingDays ?? ["MON", "TUE", "WED", "THU", "FRI"],
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "OFFICE_CREATED",
      entityType: "Office",
      entityId: office.id,
      newValue: { name: office.name, country: office.country, city: office.city },
    },
  });

  return NextResponse.json(office, { status: 201 });
}
