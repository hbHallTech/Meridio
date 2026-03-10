import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contractCreateSchema } from "@/lib/validators";

// Select fields visible to HR (excludes nothing — HR sees all)
const CONTRACT_SELECT = {
  id: true,
  type: true,
  status: true,
  contractNumber: true,
  startDate: true,
  endDate: true,
  trialPeriodEnd: true,
  weeklyHours: true,
  salaryGrossMonthly: true,
  salaryGrossHourly: true,
  currency: true,
  paymentFrequency: true,
  paymentMethod: true,
  jobTitle: true,
  department: true,
  managerId: true,
  conventionCollective: true,
  location: true,
  remoteAllowed: true,
  remotePercentage: true,
  notes: true,
  documentId: true,
  createdBy: true,
  signedAt: true,
  terminatedAt: true,
  terminationReason: true,
  createdAt: true,
  updatedAt: true,
  manager: { select: { id: true, firstName: true, lastName: true } },
} as const;

function isHrOrAdmin(roles?: string[]): boolean {
  if (!roles) return false;
  return roles.includes("HR") || roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
}

// ─── GET: list all contracts for a user (HR/ADMIN only) ───

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!isHrOrAdmin(session.user.roles)) {
    return NextResponse.json({ error: "Accès réservé RH/Admin" }, { status: 403 });
  }

  const { userId } = await params;

  // Verify user exists
  const userExists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!userExists) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const contracts = await prisma.contract.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    select: CONTRACT_SELECT,
  });

  return NextResponse.json(contracts);
}

// ─── POST: create a new contract (HR/ADMIN only) ───

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!isHrOrAdmin(session.user.roles)) {
    return NextResponse.json({ error: "Accès réservé RH/Admin" }, { status: 403 });
  }

  const { userId } = await params;

  // Verify user exists
  const userExists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!userExists) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = contractCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message, details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // If status is ACTIF, check no other ACTIF contract exists for this user
    const statusToUse = data.status ?? "EN_ATTENTE_SIGNATURE";
    if (statusToUse === "ACTIF") {
      const existingActive = await prisma.contract.findFirst({
        where: { userId, status: "ACTIF" },
        select: { id: true, contractNumber: true },
      });
      if (existingActive) {
        return NextResponse.json(
          {
            error: `L'utilisateur a déjà un contrat actif (${existingActive.contractNumber || existingActive.id}). Terminez-le avant d'en créer un nouveau.`,
          },
          { status: 409 }
        );
      }
    }

    // Validate managerId if provided
    if (data.managerId) {
      const managerExists = await prisma.user.findUnique({
        where: { id: data.managerId },
        select: { id: true },
      });
      if (!managerExists) {
        return NextResponse.json({ error: "Manager introuvable" }, { status: 400 });
      }
    }

    const contract = await prisma.contract.create({
      data: {
        userId,
        type: data.type,
        status: statusToUse as "ACTIF" | "TERMINE" | "SUSPENDU" | "EN_PROLONGATION" | "EN_ATTENTE_SIGNATURE",
        contractNumber: data.contractNumber || null,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        trialPeriodEnd: data.trialPeriodEnd ? new Date(data.trialPeriodEnd) : null,
        weeklyHours: data.weeklyHours ?? null,
        salaryGrossMonthly: data.salaryGrossMonthly ?? null,
        salaryGrossHourly: data.salaryGrossHourly ?? null,
        currency: data.currency,
        paymentFrequency: data.paymentFrequency || null,
        paymentMethod: data.paymentMethod || null,
        jobTitle: data.jobTitle,
        department: data.department || null,
        managerId: data.managerId || null,
        conventionCollective: data.conventionCollective || null,
        location: data.location || null,
        remoteAllowed: data.remoteAllowed,
        remotePercentage: data.remotePercentage ?? null,
        notes: data.notes || null,
        documentId: data.documentId || null,
        createdBy: session.user.id,
        signedAt: data.signedAt ? new Date(data.signedAt) : null,
      },
      select: CONTRACT_SELECT,
    });

    // Sync hireDate on User if contract is ACTIF and startDate < current hireDate
    if (statusToUse === "ACTIF") {
      await syncUserDatesFromContract(userId, contract.startDate, null);
    }

    // Audit log (sensitive: salary fields logged generically)
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CONTRACT_CREATED",
        entityType: "Contract",
        entityId: contract.id,
        newValue: {
          type: data.type,
          status: statusToUse,
          jobTitle: data.jobTitle,
          forUserId: userId,
          hasSalaryData: !!(data.salaryGrossMonthly || data.salaryGrossHourly),
        },
      },
    });

    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    console.error("POST /api/users/[userId]/contracts error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du contrat" },
      { status: 500 }
    );
  }
}

// ─── Helper: sync hireDate/departureDate on User from active contract ───

async function syncUserDatesFromContract(
  userId: string,
  startDate: Date | null,
  terminatedAt: Date | null
) {
  const updateData: Record<string, unknown> = {};

  if (startDate) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { hireDate: true },
    });
    // Only update hireDate if the contract startDate is earlier
    if (user && (!user.hireDate || startDate < user.hireDate)) {
      updateData.hireDate = startDate;
    }
  }

  if (terminatedAt) {
    updateData.departureDate = terminatedAt;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.user.update({ where: { id: userId }, data: updateData });
  }
}
