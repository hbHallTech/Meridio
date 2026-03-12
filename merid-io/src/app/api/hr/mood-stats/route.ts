import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/hr/mood-stats?period=week|month&teamId=xxx
 *
 * Aggregated mood stats for HR/ADMIN/MANAGER.
 * Returns distribution (count per mood level) + average score.
 * Anonymized: no individual user data is returned.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const roles = session.user.roles ?? [];
    const isHrOrAdmin = roles.includes("HR") || roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
    const isManager = roles.includes("MANAGER");

    if (!isHrOrAdmin && !isManager) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const period = searchParams.get("period") || "week";
    const teamId = searchParams.get("teamId");

    // Calculate date range
    const now = new Date();
    const from = new Date();
    if (period === "month") {
      from.setDate(from.getDate() - 30);
    } else {
      from.setDate(from.getDate() - 7);
    }

    // Build user filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userFilter: any = {};

    if (isManager && !isHrOrAdmin) {
      // Manager can only see their team's aggregated data
      const managedTeam = await prisma.team.findFirst({
        where: { managerId: session.user.id },
        select: { id: true },
      });
      if (!managedTeam) {
        return NextResponse.json({ distribution: {}, average: null, total: 0 });
      }
      userFilter.teamId = managedTeam.id;
    } else if (teamId) {
      // HR/Admin filtering by specific team
      userFilter.teamId = teamId;
    }

    const checkins = await prisma.moodCheckin.findMany({
      where: {
        createdAt: { gte: from, lte: now },
        ...(Object.keys(userFilter).length > 0
          ? { user: userFilter }
          : {}),
      },
      select: { mood: true, createdAt: true },
    });

    // Calculate distribution
    const distribution: Record<string, number> = {
      VERY_BAD: 0,
      BAD: 0,
      NEUTRAL: 0,
      GOOD: 0,
      VERY_GOOD: 0,
    };
    const moodValues: Record<string, number> = {
      VERY_BAD: 1,
      BAD: 2,
      NEUTRAL: 3,
      GOOD: 4,
      VERY_GOOD: 5,
    };

    for (const c of checkins) {
      distribution[c.mood] = (distribution[c.mood] || 0) + 1;
    }

    const total = checkins.length;
    const average = total > 0
      ? checkins.reduce((sum, c) => sum + moodValues[c.mood], 0) / total
      : null;

    // Weekly breakdown for chart
    const weeklyData: Record<string, { sum: number; count: number }> = {};
    for (const c of checkins) {
      const weekKey = getWeekKey(c.createdAt);
      if (!weeklyData[weekKey]) weeklyData[weekKey] = { sum: 0, count: 0 };
      weeklyData[weekKey].sum += moodValues[c.mood];
      weeklyData[weekKey].count += 1;
    }

    const trend = Object.entries(weeklyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, data]) => ({
        week,
        average: Math.round((data.sum / data.count) * 100) / 100,
        count: data.count,
      }));

    return NextResponse.json({ distribution, average, total, trend });
  } catch (err) {
    console.error("[hr/mood-stats] GET error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + 1); // Monday
  return d.toISOString().slice(0, 10);
}
