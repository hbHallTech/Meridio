import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

// GET: list delegations created by the current manager
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "manager:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const delegations = await prisma.delegation.findMany({
    where: { fromUserId: session.user.id },
    include: {
      toUser: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { startDate: "desc" },
  });

  // Get eligible colleagues (same office, active, not the manager themselves)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { officeId: true },
  });

  const colleagues = user
    ? await prisma.user.findMany({
        where: {
          officeId: user.officeId,
          isActive: true,
          id: { not: session.user.id },
        },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      })
    : [];

  const now = new Date();

  const items = delegations.map((d) => ({
    id: d.id,
    toUser: d.toUser,
    startDate: d.startDate,
    endDate: d.endDate,
    isActive: d.isActive,
    isCurrentlyActive: d.isActive && d.startDate <= now && d.endDate >= now,
    isPast: d.endDate < now,
    createdAt: d.createdAt,
  }));

  return NextResponse.json({ delegations: items, colleagues });
}

// POST: create a new delegation
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "manager:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  const { toUserId, startDate, endDate } = body;

  if (!toUserId || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Tous les champs sont obligatoires" },
      { status: 400 }
    );
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    return NextResponse.json(
      { error: "La date de fin doit être après la date de début" },
      { status: 400 }
    );
  }

  if (toUserId === session.user.id) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas vous déléguer à vous-même" },
      { status: 400 }
    );
  }

  // Check for overlapping active delegations to the same user
  const overlap = await prisma.delegation.findFirst({
    where: {
      fromUserId: session.user.id,
      toUserId,
      isActive: true,
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });

  if (overlap) {
    return NextResponse.json(
      { error: "Une délégation active existe déjà pour cette période avec ce collègue" },
      { status: 400 }
    );
  }

  const delegation = await prisma.delegation.create({
    data: {
      fromUserId: session.user.id,
      toUserId,
      startDate: start,
      endDate: end,
      createdBy: "MANAGER",
      isActive: true,
    },
    include: {
      toUser: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELEGATION_CREATED",
      entityType: "Delegation",
      entityId: delegation.id,
      newValue: {
        toUserId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    },
  });

  return NextResponse.json(delegation, { status: 201 });
}
