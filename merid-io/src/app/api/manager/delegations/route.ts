import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];
  if (!roles.includes("MANAGER") && !roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  const delegations = await prisma.delegation.findMany({
    where: { fromUserId: session.user.id },
    include: {
      fromUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      toUser: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Users the manager can delegate to (active users excluding self)
  const users = await prisma.user.findMany({
    where: { isActive: true, id: { not: session.user.id } },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json({ delegations, users });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];
  if (!roles.includes("MANAGER") && !roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  const body = await request.json();
  const { toUserId, startDate, endDate } = body;

  if (!toUserId || !startDate || !endDate) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  if (toUserId === session.user.id) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas vous deleguer a vous-meme" },
      { status: 400 }
    );
  }

  const delegation = await prisma.delegation.create({
    data: {
      fromUserId: session.user.id,
      toUserId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      createdBy: "MANAGER",
      isActive: true,
    },
    include: {
      fromUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      toUser: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELEGATION_CREATED",
      entityType: "Delegation",
      entityId: delegation.id,
      newValue: {
        fromUserId: session.user.id,
        toUserId,
        startDate,
        endDate,
        createdBy: "MANAGER",
      },
    },
  });

  return NextResponse.json(delegation, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];
  if (!roles.includes("MANAGER") && !roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  const body = await request.json();
  const { id, startDate, endDate, isActive } = body;

  if (!id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  const existing = await prisma.delegation.findUnique({ where: { id } });
  if (!existing || existing.fromUserId !== session.user.id) {
    return NextResponse.json({ error: "Delegation introuvable" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (startDate !== undefined) updateData.startDate = new Date(startDate);
  if (endDate !== undefined) updateData.endDate = new Date(endDate);
  if (isActive !== undefined) updateData.isActive = isActive;

  const delegation = await prisma.delegation.update({
    where: { id },
    data: updateData,
    include: {
      fromUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      toUser: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: isActive === false ? "DELEGATION_REVOKED" : "DELEGATION_CREATED",
      entityType: "Delegation",
      entityId: id,
      oldValue: { startDate: existing.startDate, endDate: existing.endDate, isActive: existing.isActive },
      newValue: updateData as Record<string, string | number | boolean | Date>,
    },
  });

  return NextResponse.json(delegation);
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];
  if (!roles.includes("MANAGER") && !roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  const existing = await prisma.delegation.findUnique({ where: { id } });
  if (!existing || existing.fromUserId !== session.user.id) {
    return NextResponse.json({ error: "Delegation introuvable" }, { status: 404 });
  }

  await prisma.delegation.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELEGATION_REVOKED",
      entityType: "Delegation",
      entityId: id,
      oldValue: {
        fromUserId: existing.fromUserId,
        toUserId: existing.toUserId,
        startDate: existing.startDate,
        endDate: existing.endDate,
      },
    },
  });

  return NextResponse.json({ success: true });
}
