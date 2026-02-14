import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Lightweight endpoint for any authenticated user to get company branding
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const company = await prisma.company.findFirst({
    select: {
      id: true,
      name: true,
      logoUrl: true,
    },
  });

  return NextResponse.json(company ?? null);
}
