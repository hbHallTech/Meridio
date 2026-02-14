import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { UserRole, Prisma } from "@prisma/client";

// GET — List leave type configs (optionally filter by officeId)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "admin:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const officeId = searchParams.get("officeId") ?? "";

  const where = officeId ? { officeId } : {};

  const leaveTypes = await prisma.leaveTypeConfig.findMany({
    where,
    include: {
      office: { select: { id: true, name: true, city: true } },
    },
    orderBy: [{ office: { name: "asc" } }, { code: "asc" }],
  });

  const offices = await prisma.office.findMany({
    select: { id: true, name: true, city: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ leaveTypes, offices });
}

// POST — Create a leave type config
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
    officeId,
    code,
    label_fr,
    label_en,
    requiresAttachment,
    attachmentFromDay,
    deductsFromBalance,
    balanceType,
    color,
    isActive,
  } = body;

  if (!officeId || !code?.trim() || !label_fr?.trim() || !label_en?.trim()) {
    return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
  }

  // Check uniqueness
  const dup = await prisma.leaveTypeConfig.findUnique({
    where: { officeId_code: { officeId, code: code.trim().toUpperCase() } },
  });
  if (dup) {
    return NextResponse.json({ error: "Ce code existe déjà pour ce bureau" }, { status: 409 });
  }

  const leaveType = await prisma.leaveTypeConfig.create({
    data: {
      officeId,
      code: code.trim().toUpperCase(),
      label_fr: label_fr.trim(),
      label_en: label_en.trim(),
      requiresAttachment: requiresAttachment ?? false,
      attachmentFromDay: attachmentFromDay ? Number(attachmentFromDay) : null,
      deductsFromBalance: deductsFromBalance ?? true,
      balanceType: balanceType || null,
      color: color || "#3B82F6",
      isActive: isActive ?? true,
    },
    include: {
      office: { select: { id: true, name: true, city: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "LEAVE_TYPE_CREATED",
      entityType: "LeaveTypeConfig",
      entityId: leaveType.id,
      newValue: {
        code: leaveType.code,
        label_fr: leaveType.label_fr,
        label_en: leaveType.label_en,
        officeId,
      } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json(leaveType, { status: 201 });
}

// PATCH — Update a leave type config
export async function PATCH(request: NextRequest) {
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
    leaveTypeId,
    label_fr,
    label_en,
    requiresAttachment,
    attachmentFromDay,
    deductsFromBalance,
    balanceType,
    color,
    isActive,
  } = body;

  if (!leaveTypeId) {
    return NextResponse.json({ error: "leaveTypeId requis" }, { status: 400 });
  }

  const existing = await prisma.leaveTypeConfig.findUnique({ where: { id: leaveTypeId } });
  if (!existing) {
    return NextResponse.json({ error: "Type de congé non trouvé" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (label_fr?.trim()) data.label_fr = label_fr.trim();
  if (label_en?.trim()) data.label_en = label_en.trim();
  if (requiresAttachment !== undefined) data.requiresAttachment = requiresAttachment;
  if (attachmentFromDay !== undefined) data.attachmentFromDay = attachmentFromDay ? Number(attachmentFromDay) : null;
  if (deductsFromBalance !== undefined) data.deductsFromBalance = deductsFromBalance;
  if (balanceType !== undefined) data.balanceType = balanceType || null;
  if (color) data.color = color;
  if (isActive !== undefined) data.isActive = isActive;

  const updated = await prisma.leaveTypeConfig.update({
    where: { id: leaveTypeId },
    data,
    include: {
      office: { select: { id: true, name: true, city: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "LEAVE_TYPE_UPDATED",
      entityType: "LeaveTypeConfig",
      entityId: leaveTypeId,
      oldValue: {
        label_fr: existing.label_fr,
        label_en: existing.label_en,
        requiresAttachment: existing.requiresAttachment,
        deductsFromBalance: existing.deductsFromBalance,
        isActive: existing.isActive,
        color: existing.color,
      } as Prisma.InputJsonValue,
      newValue: data as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json(updated);
}

// DELETE — Delete a leave type config
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "admin:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const leaveTypeId = searchParams.get("leaveTypeId");

  if (!leaveTypeId) {
    return NextResponse.json({ error: "leaveTypeId requis" }, { status: 400 });
  }

  const existing = await prisma.leaveTypeConfig.findUnique({ where: { id: leaveTypeId } });
  if (!existing) {
    return NextResponse.json({ error: "Type de congé non trouvé" }, { status: 404 });
  }

  // Check if it has leave requests
  const usageCount = await prisma.leaveRequest.count({ where: { leaveTypeConfigId: leaveTypeId } });
  if (usageCount > 0) {
    // Soft delete — just deactivate
    await prisma.leaveTypeConfig.update({
      where: { id: leaveTypeId },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "LEAVE_TYPE_DEACTIVATED",
        entityType: "LeaveTypeConfig",
        entityId: leaveTypeId,
        oldValue: { code: existing.code, isActive: true } as Prisma.InputJsonValue,
        newValue: { isActive: false } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ success: true, softDeleted: true });
  }

  await prisma.leaveTypeConfig.delete({ where: { id: leaveTypeId } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "LEAVE_TYPE_DELETED",
      entityType: "LeaveTypeConfig",
      entityId: leaveTypeId,
      oldValue: {
        code: existing.code,
        label_fr: existing.label_fr,
        label_en: existing.label_en,
      } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ success: true });
}
