import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { UserRole, Prisma } from "@prisma/client";

// GET — List exceptional rules for an office
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

  const rules = await prisma.exceptionalLeaveRule.findMany({
    where: { officeId: id },
    orderBy: { reason_fr: "asc" },
  });

  return NextResponse.json({ rules });
}

// POST — Create a new exceptional leave rule
export async function POST(
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
  const { reason_fr, reason_en, maxDays, isActive } = body;

  if (!reason_fr?.trim() || !reason_en?.trim() || !maxDays) {
    return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
  }

  const rule = await prisma.exceptionalLeaveRule.create({
    data: {
      officeId: id,
      reason_fr: reason_fr.trim(),
      reason_en: reason_en.trim(),
      maxDays: Number(maxDays),
      isActive: isActive ?? true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "EXCEPTIONAL_RULE_CREATED",
      entityType: "ExceptionalLeaveRule",
      entityId: rule.id,
      newValue: { reason_fr: rule.reason_fr, reason_en: rule.reason_en, maxDays: rule.maxDays },
    },
  });

  return NextResponse.json(rule, { status: 201 });
}

// PATCH — Update an exceptional rule
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

  const body = await request.json();
  const { ruleId, reason_fr, reason_en, maxDays, isActive } = body;

  if (!ruleId) {
    return NextResponse.json({ error: "ruleId requis" }, { status: 400 });
  }

  const existing = await prisma.exceptionalLeaveRule.findUnique({ where: { id: ruleId } });
  if (!existing) {
    return NextResponse.json({ error: "Règle non trouvée" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (reason_fr?.trim()) updateData.reason_fr = reason_fr.trim();
  if (reason_en?.trim()) updateData.reason_en = reason_en.trim();
  if (maxDays !== undefined) updateData.maxDays = Number(maxDays);
  if (isActive !== undefined) updateData.isActive = isActive;

  const updated = await prisma.exceptionalLeaveRule.update({
    where: { id: ruleId },
    data: updateData,
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "EXCEPTIONAL_RULE_UPDATED",
      entityType: "ExceptionalLeaveRule",
      entityId: ruleId,
      oldValue: {
        reason_fr: existing.reason_fr,
        reason_en: existing.reason_en,
        maxDays: existing.maxDays,
        isActive: existing.isActive,
      },
      newValue: updateData as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json(updated);
}

// DELETE — Delete an exceptional rule
export async function DELETE(
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

  const { searchParams } = new URL(request.url);
  const ruleId = searchParams.get("ruleId");

  if (!ruleId) {
    return NextResponse.json({ error: "ruleId requis" }, { status: 400 });
  }

  const existing = await prisma.exceptionalLeaveRule.findUnique({ where: { id: ruleId } });
  if (!existing) {
    return NextResponse.json({ error: "Règle non trouvée" }, { status: 404 });
  }

  await prisma.exceptionalLeaveRule.delete({ where: { id: ruleId } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "EXCEPTIONAL_RULE_DELETED",
      entityType: "ExceptionalLeaveRule",
      entityId: ruleId,
      oldValue: {
        reason_fr: existing.reason_fr,
        reason_en: existing.reason_en,
        maxDays: existing.maxDays,
      },
    },
  });

  return NextResponse.json({ success: true });
}
