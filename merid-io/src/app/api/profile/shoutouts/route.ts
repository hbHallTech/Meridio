import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/profile/shoutouts?tab=received|sent&limit=20
 * Get current user's shoutouts (received by default).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const tab = request.nextUrl.searchParams.get("tab") || "received";
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "20", 10), 100);

    const where =
      tab === "sent"
        ? { fromUserId: session.user.id }
        : { toUserId: session.user.id };

    const shoutouts = await prisma.shoutout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        fromUser: { select: { id: true, firstName: true, lastName: true, profilePictureUrl: true } },
        toUser: { select: { id: true, firstName: true, lastName: true, profilePictureUrl: true } },
      },
    });

    return NextResponse.json(shoutouts);
  } catch (err) {
    console.error("[profile/shoutouts] GET error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
