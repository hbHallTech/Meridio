import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const closures = await prisma.companyClosure.findMany({
    include: {
      office: { select: { id: true, name: true } },
    },
    orderBy: [{ startDate: "desc" }],
  });

  return NextResponse.json(closures);
}
