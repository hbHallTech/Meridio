import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyEventAssigned } from "@/lib/notifications";

/**
 * GET /api/hr/events?type=FORMATION&from=2026-01-01&to=2026-12-31
 *
 * HR/ADMIN: all events.
 * Others: only events assigned to them (directly or via team).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const roles = session.user.roles ?? [];
    const isHrOrAdmin = roles.includes("HR") || roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");

    const { searchParams } = request.nextUrl;
    const typeFilter = searchParams.get("type");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (typeFilter) {
      where.type = typeFilter;
    }
    if (from || to) {
      where.startDate = {};
      if (from) where.startDate.gte = new Date(from);
      if (to) where.startDate.lte = new Date(to);
    }

    if (!isHrOrAdmin) {
      // Regular users only see events assigned to them or their team
      where.OR = [
        { assignedUsers: { some: { id: session.user.id } } },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...((session.user as any).teamId
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? [{ assignedTeams: { some: { id: (session.user as any).teamId } } }]
          : []),
      ];
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { startDate: "desc" },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true } },
        assignedTeams: { select: { id: true, name: true } },
        assignedUsers: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return NextResponse.json(events);
  } catch (err) {
    console.error("[hr/events] GET error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

/**
 * POST /api/hr/events
 *
 * Create a new event. HR/ADMIN only.
 * Body: { title, description?, type, startDate, endDate?, location?, teamIds?, userIds? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const roles = session.user.roles ?? [];
    if (!roles.includes("HR") && !roles.includes("ADMIN") && !roles.includes("SUPER_ADMIN")) {
      return NextResponse.json({ error: "Accès réservé RH/Admin" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, type, startDate, endDate, location, teamIds, userIds } = body;

    if (!title || !type || !startDate) {
      return NextResponse.json(
        { error: "Champs requis : title, type, startDate" },
        { status: 400 }
      );
    }

    const validTypes = ["SEMINAIRE", "FORMATION", "TEAM_BUILDING", "CONFERENCE", "OTHER"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Type invalide" }, { status: 400 });
    }

    const event = await prisma.event.create({
      data: {
        title,
        description: description || null,
        type,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        location: location || null,
        creatorId: session.user.id,
        ...(teamIds?.length ? { assignedTeams: { connect: teamIds.map((id: string) => ({ id })) } } : {}),
        ...(userIds?.length ? { assignedUsers: { connect: userIds.map((id: string) => ({ id })) } } : {}),
      },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true } },
        assignedTeams: { select: { id: true, name: true } },
        assignedUsers: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Collect all assigned user IDs (direct + via teams) for notification
    const directUserIds: string[] = userIds ?? [];
    let teamMemberIds: string[] = [];
    if (teamIds?.length) {
      const teams = await prisma.team.findMany({
        where: { id: { in: teamIds } },
        include: { members: { select: { id: true } } },
      });
      teamMemberIds = teams.flatMap((t) => t.members.map((m) => m.id));
    }
    const allAssignedIds = [...new Set([...directUserIds, ...teamMemberIds])];

    if (allAssignedIds.length > 0) {
      const creator = event.creator;
      const creatorName = `${creator.firstName} ${creator.lastName}`;
      void notifyEventAssigned(allAssignedIds, {
        eventId: event.id,
        eventTitle: title,
        eventType: type,
        startDate: new Date(startDate).toLocaleDateString("fr-FR"),
        location: location || undefined,
        creatorName,
      }).catch((err) => {
        console.error("[hr/events] notification error:", err);
      });
    }

    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    console.error("[hr/events] POST error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
