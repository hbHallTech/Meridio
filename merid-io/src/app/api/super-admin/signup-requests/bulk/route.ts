import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSignupRejectionEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import type { UserRole } from "@prisma/client";

/**
 * POST /api/super-admin/signup-requests/bulk
 *
 * Bulk reject signup requests. Bulk approve is intentionally not supported
 * because each tenant needs individual attention during provisioning.
 *
 * Body: { action: "reject", ids: string[], notes?: string }
 */
export async function POST(request: Request) {
  const session = await auth();
  const roles = (session?.user?.roles ?? []) as UserRole[];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { action, ids, notes } = body;

  if (action !== "reject") {
    return NextResponse.json(
      { error: "Seule l'action 'reject' est supportée en masse" },
      { status: 400 }
    );
  }

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) {
    return NextResponse.json(
      { error: "Fournissez entre 1 et 50 IDs" },
      { status: 400 }
    );
  }

  // Get all pending requests matching the provided IDs
  const requests = await prisma.signupRequest.findMany({
    where: { id: { in: ids }, status: "PENDING" },
  });

  if (requests.length === 0) {
    return NextResponse.json(
      { error: "Aucune demande en attente trouvée" },
      { status: 400 }
    );
  }

  // Update all in one query
  await prisma.signupRequest.updateMany({
    where: { id: { in: requests.map((r) => r.id) } },
    data: {
      status: "REJECTED",
      reviewedById: session!.user!.id,
      reviewedAt: new Date(),
      reviewNotes: notes || null,
    },
  });

  // Send rejection emails (non-blocking)
  void Promise.allSettled(
    requests.map((req) =>
      sendSignupRejectionEmail(
        req.email,
        req.firstName,
        req.companyName,
        notes || null
      )
    )
  );

  void logAudit(session!.user!.id, "BULK_SIGNUP_REJECTED", {
    newValue: {
      count: requests.length,
      ids: requests.map((r) => r.id),
      notes: notes || null,
    },
  });

  return NextResponse.json({
    success: true,
    message: `${requests.length} demande(s) rejetée(s)`,
    rejectedCount: requests.length,
    skippedCount: ids.length - requests.length,
  });
}
