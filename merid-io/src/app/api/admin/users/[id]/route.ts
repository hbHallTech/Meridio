import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";

// GET — User profile detail (info, balances, leave history, audit)
export async function GET(
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

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      roles: true,
      isActive: true,
      hireDate: true,
      language: true,
      profilePictureUrl: true,
      passwordChangedAt: true,
      createdAt: true,
      updatedAt: true,
      office: { select: { id: true, name: true, city: true } },
      team: { select: { id: true, name: true } },
      managedTeam: { select: { id: true, name: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
  }

  // Current year balances
  const currentYear = new Date().getFullYear();
  const balances = await prisma.leaveBalance.findMany({
    where: { userId: id, year: currentYear },
  });

  // Leave requests (recent 50)
  const leaveRequests = await prisma.leaveRequest.findMany({
    where: { userId: id },
    include: {
      leaveTypeConfig: {
        select: { code: true, label_fr: true, label_en: true, color: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Audit logs for this user (recent 50)
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: "User", entityId: id },
        { userId: id },
      ],
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ user, balances, leaveRequests, auditLogs });
}

// PATCH — Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "user:update")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { firstName, lastName, email, officeId, teamId, roles, hireDate, password } = body;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
  }

  // Build update data
  const updateData: Record<string, unknown> = {};
  if (firstName?.trim()) updateData.firstName = firstName.trim();
  if (lastName?.trim()) updateData.lastName = lastName.trim();
  if (email?.trim()) {
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail.endsWith("@halley-technologies.ch")) {
      return NextResponse.json({ error: "L'email doit être @halley-technologies.ch" }, { status: 400 });
    }
    // Check if email is taken by another user
    const emailUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (emailUser && emailUser.id !== id) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
    }
    updateData.email = normalizedEmail;
  }
  if (officeId) updateData.officeId = officeId;
  if (teamId !== undefined) updateData.teamId = teamId || null;
  if (roles?.length) updateData.roles = roles as UserRole[];
  if (hireDate) updateData.hireDate = new Date(hireDate);
  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 12);
    updateData.passwordChangedAt = new Date();
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      roles: true,
      isActive: true,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: id,
      oldValue: {
        firstName: existing.firstName,
        lastName: existing.lastName,
        email: existing.email,
        roles: existing.roles,
        officeId: existing.officeId,
        teamId: existing.teamId,
      },
      newValue: updateData,
    },
  });

  return NextResponse.json(updated);
}

// DELETE — Soft deactivate user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "user:delete")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { id } = await params;

  // Cannot deactivate yourself
  if (id === session.user.id) {
    return NextResponse.json({ error: "Vous ne pouvez pas vous désactiver vous-même" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: user.isActive ? "USER_DEACTIVATED" : "USER_REACTIVATED",
      entityType: "User",
      entityId: id,
      oldValue: { isActive: user.isActive },
      newValue: { isActive: !user.isActive },
    },
  });

  return NextResponse.json({ success: true, isActive: !user.isActive });
}
