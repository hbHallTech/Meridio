import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contractUpdateSchema } from "@/lib/validators";

function isHrOrAdmin(roles?: string[]): boolean {
  if (!roles) return false;
  return roles.includes("HR") || roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
}

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

type RouteParams = { params: Promise<{ userId: string; contractId: string }> };

// ─── PATCH: update a contract (HR/ADMIN only) ───

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!isHrOrAdmin(session.user.roles)) {
    return NextResponse.json({ error: "Accès réservé RH/Admin" }, { status: 403 });
  }

  const { userId, contractId } = await params;

  try {
    // Verify contract exists and belongs to user
    const existing = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        userId: true,
        status: true,
        salaryGrossMonthly: true,
        salaryGrossHourly: true,
      },
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = contractUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message, details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const statusToUse = data.status ?? existing.status;

    // If transitioning to ACTIF, check no other ACTIF contract exists
    if (statusToUse === "ACTIF" && existing.status !== "ACTIF") {
      const existingActive = await prisma.contract.findFirst({
        where: { userId, status: "ACTIF", id: { not: contractId } },
        select: { id: true },
      });
      if (existingActive) {
        return NextResponse.json(
          { error: "L'utilisateur a déjà un contrat actif. Terminez-le d'abord." },
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

    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: {
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
        signedAt: data.signedAt ? new Date(data.signedAt) : null,
      },
      select: CONTRACT_SELECT,
    });

    // Sync hireDate if activated
    if (statusToUse === "ACTIF") {
      await syncUserDates(userId, updated.startDate, null);
    }

    // Audit log — track salary changes without logging actual amounts
    const salaryChanged =
      data.salaryGrossMonthly !== undefined &&
      data.salaryGrossMonthly !== existing.salaryGrossMonthly;
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CONTRACT_UPDATED",
        entityType: "Contract",
        entityId: contractId,
        oldValue: { status: existing.status },
        newValue: {
          status: statusToUse,
          type: data.type,
          jobTitle: data.jobTitle,
          salaryChanged,
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/users/[userId]/contracts/[contractId] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du contrat" },
      { status: 500 }
    );
  }
}

// ─── DELETE: soft-delete via status TERMINE (HR/ADMIN only) ───

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!isHrOrAdmin(session.user.roles)) {
    return NextResponse.json({ error: "Accès réservé RH/Admin" }, { status: 403 });
  }

  const { userId, contractId } = await params;

  try {
    const existing = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, userId: true, status: true, type: true, jobTitle: true },
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
    }

    // Soft-delete: set status to TERMINE + terminatedAt
    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: "TERMINE",
        terminatedAt: new Date(),
        terminationReason: "Supprimé par RH",
      },
    });

    // Sync departureDate
    await syncUserDates(userId, null, updated.terminatedAt);

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CONTRACT_TERMINATED",
        entityType: "Contract",
        entityId: contractId,
        oldValue: { status: existing.status },
        newValue: { status: "TERMINE", type: existing.type, jobTitle: existing.jobTitle },
      },
    });

    return NextResponse.json({ success: true, status: "TERMINE" });
  } catch (error) {
    console.error("DELETE /api/users/[userId]/contracts/[contractId] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du contrat" },
      { status: 500 }
    );
  }
}

async function syncUserDates(
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
