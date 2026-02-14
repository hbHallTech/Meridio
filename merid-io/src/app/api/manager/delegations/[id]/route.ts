import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH: cancel a delegation (set isActive = false)
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  const delegation = await prisma.delegation.findUnique({
    where: { id },
  });

  if (!delegation) {
    return NextResponse.json({ error: "Délégation introuvable" }, { status: 404 });
  }

  if (delegation.fromUserId !== session.user.id) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  if (!delegation.isActive) {
    return NextResponse.json(
      { error: "Cette délégation est déjà annulée" },
      { status: 400 }
    );
  }

  await prisma.delegation.update({
    where: { id },
    data: { isActive: false },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELEGATION_CANCELLED",
      entityType: "Delegation",
      entityId: id,
      oldValue: { isActive: true },
      newValue: { isActive: false },
    },
  });

  return NextResponse.json({ success: true });
}
