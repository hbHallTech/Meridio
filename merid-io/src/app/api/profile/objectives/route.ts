import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ─── GET: list all objectives for the authenticated user (read-only) ───

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const objectives = await prisma.objective.findMany({
    where: { userId: session.user.id },
    orderBy: [{ status: "asc" }, { deadline: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      deadline: true,
      status: true,
      progress: true,
      selfComment: true,
      managerComment: true,
      createdAt: true,
      updatedAt: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Stats summary
  const total = objectives.length;
  const achieved = objectives.filter((o) => o.status === "ACHIEVED").length;
  const inProgress = objectives.filter((o) => o.status === "IN_PROGRESS").length;
  const achievementRate = total > 0 ? Math.round((achieved / total) * 100) : null;

  return NextResponse.json({
    objectives,
    stats: { total, achieved, inProgress, achievementRate },
  });
}
