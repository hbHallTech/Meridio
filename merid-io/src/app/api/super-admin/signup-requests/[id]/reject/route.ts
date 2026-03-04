import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSignupRejectionEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import type { UserRole } from "@prisma/client";

/**
 * POST /api/super-admin/signup-requests/[id]/reject
 *
 * Rejects a signup request and sends a notification email to the requester.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user?.roles ?? []) as UserRole[];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const signupRequest = await prisma.signupRequest.findUnique({
    where: { id },
  });

  if (!signupRequest) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }

  if (signupRequest.status !== "PENDING") {
    return NextResponse.json(
      { error: "Cette demande a déjà été traitée" },
      { status: 400 }
    );
  }

  await prisma.signupRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedById: session!.user!.id,
      reviewedAt: new Date(),
      reviewNotes: body.notes || null,
    },
  });

  // Send rejection email (non-blocking)
  void sendSignupRejectionEmail(
    signupRequest.email,
    signupRequest.firstName,
    signupRequest.companyName,
    body.notes || null
  ).catch((err) => console.error("[tenant] Rejection email failed:", err));

  void logAudit(session!.user!.id, "SIGNUP_REQUEST_REJECTED", {
    entityType: "SignupRequest",
    entityId: id,
    newValue: {
      email: signupRequest.email,
      companyName: signupRequest.companyName,
      notes: body.notes || null,
    },
  });

  return NextResponse.json({
    success: true,
    message: "Demande rejetée. Un email de notification a été envoyé.",
  });
}
