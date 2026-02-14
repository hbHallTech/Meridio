import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { UserRole, Prisma } from "@prisma/client";

// GET — Office detail with exceptional rules
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "admin:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { id } = await params;

  const office = await prisma.office.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true } },
      exceptionalLeaveRules: { orderBy: { reason_fr: "asc" } },
      _count: { select: { users: true, teams: true } },
    },
  });

  if (!office) {
    return NextResponse.json({ error: "Bureau non trouvé" }, { status: 404 });
  }

  // Also get companies for dropdown
  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ office, companies });
}

// PATCH — Update office settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "admin:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.office.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Bureau non trouvé" }, { status: 404 });
  }

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

  const updateData: Record<string, unknown> = {};
  if (name?.trim()) updateData.name = name.trim();
  if (country?.trim()) updateData.country = country.trim();
  if (city?.trim()) updateData.city = city.trim();
  if (companyId) updateData.companyId = companyId;
  if (defaultAnnualLeave !== undefined) updateData.defaultAnnualLeave = Number(defaultAnnualLeave);
  if (defaultOfferedDays !== undefined) updateData.defaultOfferedDays = Number(defaultOfferedDays);
  if (minNoticeDays !== undefined) updateData.minNoticeDays = Number(minNoticeDays);
  if (maxCarryOverDays !== undefined) updateData.maxCarryOverDays = Number(maxCarryOverDays);
  if (carryOverDeadline !== undefined) updateData.carryOverDeadline = carryOverDeadline;
  if (probationMonths !== undefined) updateData.probationMonths = Number(probationMonths);
  if (sickLeaveJustifFromDay !== undefined) updateData.sickLeaveJustifFromDay = Number(sickLeaveJustifFromDay);
  if (workingDays !== undefined) updateData.workingDays = workingDays;

  const updated = await prisma.office.update({
    where: { id },
    data: updateData,
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "OFFICE_UPDATED",
      entityType: "Office",
      entityId: id,
      oldValue: {
        name: existing.name,
        country: existing.country,
        city: existing.city,
        defaultAnnualLeave: existing.defaultAnnualLeave,
        defaultOfferedDays: existing.defaultOfferedDays,
        minNoticeDays: existing.minNoticeDays,
        maxCarryOverDays: existing.maxCarryOverDays,
        carryOverDeadline: existing.carryOverDeadline,
        probationMonths: existing.probationMonths,
        sickLeaveJustifFromDay: existing.sickLeaveJustifFromDay,
        workingDays: existing.workingDays,
      },
      newValue: updateData as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json(updated);
}
