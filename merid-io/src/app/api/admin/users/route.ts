import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      roles: true,
      isActive: true,
      hireDate: true,
      language: true,
      createdAt: true,
      office: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
    },
    orderBy: { lastName: "asc" },
  });

  return NextResponse.json(users);
}
