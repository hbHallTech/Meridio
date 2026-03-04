import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { queueEmail } from "@/lib/email-queue";
import { buildSignupRejectionHtml } from "@/lib/email-templates";
import { logAudit } from "@/lib/audit";
import type { UserRole } from "@prisma/client";

/**
 * POST /api/super-admin/signup-requests/[id]/reject
 *
 * Rejects a signup request and queues a notification email to the requester.
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

  // Queue rejection email (reliable delivery with retries)
  const rejectionHtml = buildSignupRejectionHtml(
    signupRequest.firstName,
    signupRequest.companyName,
    body.notes || null
  );

  const emailLogId = await queueEmail({
    type: "SIGNUP_REJECTION",
    to: signupRequest.email,
    subject: "Meridio - Votre demande d'inscription",
    html: rejectionHtml,
    signupRequestId: id,
  });

  console.log(
    `[reject] Signup request rejected: id=${id} email=${signupRequest.email} emailLogId=${emailLogId}`
  );

  void logAudit(session!.user!.id, "SIGNUP_REQUEST_REJECTED", {
    entityType: "SignupRequest",
    entityId: id,
    newValue: {
      email: signupRequest.email,
      companyName: signupRequest.companyName,
      notes: body.notes || null,
      emailLogId,
    },
  });

  return NextResponse.json({
    success: true,
    message: "Demande rejetée. Un email de notification a été mis en file d'attente.",
    emailLogId,
  });
}
