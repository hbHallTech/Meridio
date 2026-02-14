import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const offices = await prisma.office.findMany({
    include: {
      company: { select: { name: true } },
      _count: { select: { users: true, teams: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(offices);
}
