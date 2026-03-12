import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_MOODS = ["VERY_BAD", "BAD", "NEUTRAL", "GOOD", "VERY_GOOD"];

/**
 * POST /api/profile/mood-checkins
 * Submit a mood check-in. Max 1 per day per user.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { mood, comment } = body;

    if (!mood || !VALID_MOODS.includes(mood)) {
      return NextResponse.json({ error: "Mood invalide" }, { status: 400 });
    }

    if (comment && comment.length > 280) {
      return NextResponse.json({ error: "Commentaire trop long (max 280)" }, { status: 400 });
    }

    // Check if already submitted today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const existing = await prisma.moodCheckin.findFirst({
      where: {
        userId: session.user.id,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    });

    if (existing) {
      // Update today's check-in instead of creating a new one
      const updated = await prisma.moodCheckin.update({
        where: { id: existing.id },
        data: { mood, comment: comment || null },
      });
      return NextResponse.json(updated);
    }

    const checkin = await prisma.moodCheckin.create({
      data: {
        userId: session.user.id,
        mood,
        comment: comment || null,
      },
    });

    return NextResponse.json(checkin, { status: 201 });
  } catch (err) {
    console.error("[profile/mood-checkins] POST error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

/**
 * GET /api/profile/mood-checkins?limit=30
 * Get current user's mood history.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "30", 10);

    const checkins = await prisma.moodCheckin.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
    });

    return NextResponse.json(checkins);
  } catch (err) {
    console.error("[profile/mood-checkins] GET error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
