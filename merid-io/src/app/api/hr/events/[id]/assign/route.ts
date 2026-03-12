import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyEventAssigned } from "@/lib/notifications";

/**
 * PATCH /api/hr/events/[id]/assign
 *
 * Assign teams and/or users to an event. HR/ADMIN only.
 * Body: { teamIds?: string[], userIds?: string[] }
 *
 * Replaces current assignments (set, not connect).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const roles = session.user.roles ?? [];
    if (!roles.includes("HR") && !roles.includes("ADMIN") && !roles.includes("SUPER_ADMIN")) {
      return NextResponse.json({ error: "Accès réservé RH/Admin" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.event.findUnique({
      where: { id },
      include: {
        assignedUsers: { select: { id: true } },
        assignedTeams: { select: { id: true, members: { select: { id: true } } } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });
    }

    const body = await request.json();
    const { teamIds, userIds } = body as { teamIds?: string[]; userIds?: string[] };

    // Collect previously assigned user IDs
    const previousUserIds = new Set([
      ...existing.assignedUsers.map((u) => u.id),
      ...existing.assignedTeams.flatMap((t) => t.members.map((m) => m.id)),
    ]);

    const updated = await prisma.event.update({
      where: { id },
      data: {
        ...(teamIds !== undefined
          ? { assignedTeams: { set: teamIds.map((tid: string) => ({ id: tid })) } }
          : {}),
        ...(userIds !== undefined
          ? { assignedUsers: { set: userIds.map((uid: string) => ({ id: uid })) } }
          : {}),
      },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true } },
        assignedTeams: { select: { id: true, name: true } },
        assignedUsers: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Notify newly assigned users only
    const newDirectIds: string[] = userIds ?? existing.assignedUsers.map((u) => u.id);
    let newTeamMemberIds: string[] = [];
    if (teamIds?.length) {
      const teams = await prisma.team.findMany({
        where: { id: { in: teamIds } },
        include: { members: { select: { id: true } } },
      });
      newTeamMemberIds = teams.flatMap((t) => t.members.map((m) => m.id));
    }
    const allNewIds = [...new Set([...newDirectIds, ...newTeamMemberIds])];
    const newlyAssigned = allNewIds.filter((uid) => !previousUserIds.has(uid));

    if (newlyAssigned.length > 0) {
      const creatorName = `${updated.creator.firstName} ${updated.creator.lastName}`;
      void notifyEventAssigned(newlyAssigned, {
        eventId: id,
        eventTitle: existing.title,
        eventType: existing.type,
        startDate: existing.startDate.toLocaleDateString("fr-FR"),
        location: existing.location || undefined,
        creatorName,
      }).catch((err) => {
        console.error("[hr/events/assign] notification error:", err);
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[hr/events/assign] PATCH error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
