import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ─── GET: current user's active contract (read-only, limited fields) ───

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const contract = await prisma.contract.findFirst({
    where: { userId: session.user.id, status: "ACTIF" },
    select: {
      id: true,
      type: true,
      status: true,
      contractNumber: true,
      startDate: true,
      endDate: true,
      trialPeriodEnd: true,
      weeklyHours: true,
      currency: true,
      jobTitle: true,
      department: true,
      conventionCollective: true,
      location: true,
      remoteAllowed: true,
      remotePercentage: true,
      signedAt: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Also return all contracts (history) with limited info
  const history = await prisma.contract.findMany({
    where: { userId: session.user.id },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      type: true,
      status: true,
      contractNumber: true,
      startDate: true,
      endDate: true,
      jobTitle: true,
      signedAt: true,
      terminatedAt: true,
    },
  });

  return NextResponse.json({ active: contract, history });
}
