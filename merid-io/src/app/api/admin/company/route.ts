import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const companies = await prisma.company.findMany({
    include: {
      _count: { select: { offices: true } },
      offices: {
        select: { id: true, name: true, country: true, city: true },
        orderBy: { name: "asc" },
      },
    },
  });

  return NextResponse.json(companies[0] ?? null);
}
