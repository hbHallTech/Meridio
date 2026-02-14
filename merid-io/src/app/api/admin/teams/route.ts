import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const teams = await prisma.team.findMany({
    include: {
      manager: { select: { id: true, firstName: true, lastName: true, email: true } },
      office: { select: { id: true, name: true } },
      members: { select: { id: true, firstName: true, lastName: true, email: true } },
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(teams);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, managerId, officeId } = body;

    if (!name || !managerId || !officeId) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }

    // Check if manager already manages a team (managerId is @unique in schema)
    const existingTeam = await prisma.team.findUnique({ where: { managerId } });
    if (existingTeam) {
      return NextResponse.json({ error: "Ce manager gère déjà une équipe" }, { status: 409 });
    }

    const team = await prisma.team.create({
      data: { name, managerId, officeId },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        office: { select: { id: true, name: true } },
        members: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { members: true } },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: "TEAM_CREATED",
        entityType: "Team",
        entityId: team.id,
        newValue: { name, managerId, officeId },
      },
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/teams error:", error);
    return NextResponse.json({ error: "Erreur lors de la création de l'équipe" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, name, managerId, officeId } = body;

    if (!id) {
      return NextResponse.json({ error: "L'identifiant de l'équipe est requis" }, { status: 400 });
    }

    const existingTeam = await prisma.team.findUnique({ where: { id } });
    if (!existingTeam) {
      return NextResponse.json({ error: "Équipe introuvable" }, { status: 404 });
    }

    // Check if new manager already manages a different team
    if (managerId && managerId !== existingTeam.managerId) {
      const managerTeam = await prisma.team.findUnique({ where: { managerId } });
      if (managerTeam) {
        return NextResponse.json({ error: "Ce manager gère déjà une équipe" }, { status: 409 });
      }
    }

    const updateData: Record<string, string> = {};
    if (name !== undefined) updateData.name = name;
    if (managerId !== undefined) updateData.managerId = managerId;
    if (officeId !== undefined) updateData.officeId = officeId;

    const oldValue = {
      name: existingTeam.name,
      managerId: existingTeam.managerId,
      officeId: existingTeam.officeId,
    };

    const team = await prisma.team.update({
      where: { id },
      data: updateData,
      include: {
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        office: { select: { id: true, name: true } },
        members: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { members: true } },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: "TEAM_UPDATED",
        entityType: "Team",
        entityId: id,
        oldValue,
        newValue: updateData,
      },
    });

    return NextResponse.json(team);
  } catch (error) {
    console.error("PATCH /api/admin/teams error:", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour de l'équipe" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "L'identifiant de l'équipe est requis" }, { status: 400 });
    }

    const existingTeam = await prisma.team.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!existingTeam) {
      return NextResponse.json({ error: "Équipe introuvable" }, { status: 404 });
    }

    // Dissociate all members first (set teamId to null)
    await prisma.user.updateMany({
      where: { teamId: id },
      data: { teamId: null },
    });

    // Delete the team
    await prisma.team.delete({ where: { id } });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: "TEAM_DELETED",
        entityType: "Team",
        entityId: id,
        oldValue: {
          name: existingTeam.name,
          managerId: existingTeam.managerId,
          officeId: existingTeam.officeId,
          memberCount: existingTeam._count.members,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/teams error:", error);
    return NextResponse.json({ error: "Erreur lors de la suppression de l'équipe" }, { status: 500 });
  }
}
