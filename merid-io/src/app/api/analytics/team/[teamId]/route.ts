import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { computeTeamAnalytics, analyticsToCSV } from "@/lib/analytics";

/**
 * GET /api/analytics/team/[teamId]?format=csv
 *
 * Team-level people analytics. HR/ADMIN/SUPER_ADMIN or MANAGER of that team.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { teamId } = await params;
    const roles = session.user.roles ?? [];
    const isHrOrAdmin = roles.includes("HR") || roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");

    // Managers can only access their own team
    if (!isHrOrAdmin) {
      if (!roles.includes("MANAGER")) {
        return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
      }
      // Verify this manager owns the team
      const { prisma } = await import("@/lib/prisma");
      const team = await prisma.team.findFirst({
        where: { id: teamId, managerId: session.user.id },
        select: { id: true },
      });
      if (!team) {
        return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
      }
    }

    const data = await computeTeamAnalytics(teamId);
    if (!data) {
      return NextResponse.json({ error: "Équipe introuvable" }, { status: 404 });
    }

    const format = request.nextUrl.searchParams.get("format");
    if (format === "csv") {
      const csv = analyticsToCSV(data);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="analytics-team-${teamId}-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[analytics/team] GET error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
