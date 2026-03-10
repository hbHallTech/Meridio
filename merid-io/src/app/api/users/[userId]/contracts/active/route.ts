import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Fields visible to the user themselves (sensitive fields excluded)
const USER_VISIBLE_SELECT = {
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
  createdAt: true,
  manager: { select: { id: true, firstName: true, lastName: true } },
} as const;

// Full fields for HR
const HR_VISIBLE_SELECT = {
  ...USER_VISIBLE_SELECT,
  salaryGrossMonthly: true,
  salaryGrossHourly: true,
  paymentFrequency: true,
  paymentMethod: true,
  managerId: true,
  notes: true,
  documentId: true,
  createdBy: true,
  terminatedAt: true,
  terminationReason: true,
  updatedAt: true,
} as const;

// ─── GET: active contract for a user ───
// HR/ADMIN: full data ; user themselves: limited data (no salary, no notes)

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { userId } = await params;
  const roles = session.user.roles ?? [];
  const isHr = roles.includes("HR") || roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
  const isSelf = session.user.id === userId;

  // Only HR/Admin or the user themselves can access
  if (!isHr && !isSelf) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const contract = await prisma.contract.findFirst({
    where: { userId, status: "ACTIF" },
    select: isHr ? HR_VISIBLE_SELECT : USER_VISIBLE_SELECT,
  });

  if (!contract) {
    return NextResponse.json({ error: "Aucun contrat actif" }, { status: 404 });
  }

  return NextResponse.json(contract);
}
