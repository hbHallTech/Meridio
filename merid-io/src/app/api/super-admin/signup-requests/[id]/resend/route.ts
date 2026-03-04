import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { queueEmail } from "@/lib/email-queue";
import {
  buildTenantWelcomeHtml,
  buildSignupRejectionHtml,
} from "@/lib/email-templates";
import { logAudit } from "@/lib/audit";
import crypto from "crypto";
import type { UserRole } from "@prisma/client";

/**
 * POST /api/super-admin/signup-requests/[id]/resend
 *
 * Re-sends the notification email for an already-processed signup request.
 * - APPROVED: Sends a new welcome email with a fresh reset token (24h expiry).
 *   Does NOT reprovision the tenant — only regenerates the reset link.
 * - REJECTED: Sends a new rejection email with the stored admin notes.
 *
 * Idempotent-safe: calling this multiple times only generates new emails,
 * never duplicates tenant entities.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user?.roles ?? []) as UserRole[];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { id } = await params;

  const signupRequest = await prisma.signupRequest.findUnique({
    where: { id },
  });

  if (!signupRequest) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }

  if (signupRequest.status === "PENDING") {
    return NextResponse.json(
      { error: "Cette demande est encore en attente — traitez-la d'abord" },
      { status: 400 }
    );
  }

  if (signupRequest.status === "APPROVED") {
    // Find the admin user created for this tenant
    const adminUser = await prisma.user.findFirst({
      where: {
        email: signupRequest.email.toLowerCase().trim(),
        office: {
          companyId: signupRequest.provisionedCompanyId || undefined,
        },
      },
      include: { office: { select: { company: { select: { name: true } } } } },
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: "Utilisateur admin introuvable pour ce tenant" },
        { status: 404 }
      );
    }

    // Generate a fresh reset token (does NOT reprovision anything)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await prisma.user.update({
      where: { id: adminUser.id },
      data: {
        resetPasswordToken: resetTokenHash,
        resetPasswordExpiry: resetExpiry,
      },
    });

    const companyName =
      adminUser.office.company.name || signupRequest.companyName;
    const welcomeHtml = buildTenantWelcomeHtml(
      signupRequest.firstName,
      companyName,
      resetToken,
      adminUser.email
    );

    const emailLogId = await queueEmail({
      type: "TENANT_WELCOME",
      to: adminUser.email,
      subject: `Meridio - Bienvenue ${companyName} !`,
      html: welcomeHtml,
      signupRequestId: id,
      companyId: signupRequest.provisionedCompanyId ?? undefined,
      userId: adminUser.id,
    });

    void logAudit(session!.user!.id, "EMAIL_RESENT" as string, {
      entityType: "SignupRequest",
      entityId: id,
      newValue: {
        emailType: "TENANT_WELCOME",
        to: adminUser.email,
        emailLogId,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Email de bienvenue renvoyé à ${adminUser.email} avec un nouveau lien de configuration (24h).`,
      emailLogId,
    });
  }

  if (signupRequest.status === "REJECTED") {
    const rejectionHtml = buildSignupRejectionHtml(
      signupRequest.firstName,
      signupRequest.companyName,
      signupRequest.reviewNotes
    );

    const emailLogId = await queueEmail({
      type: "SIGNUP_REJECTION",
      to: signupRequest.email,
      subject: "Meridio - Votre demande d'inscription",
      html: rejectionHtml,
      signupRequestId: id,
    });

    void logAudit(session!.user!.id, "EMAIL_RESENT" as string, {
      entityType: "SignupRequest",
      entityId: id,
      newValue: {
        emailType: "SIGNUP_REJECTION",
        to: signupRequest.email,
        emailLogId,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Email de rejet renvoyé à ${signupRequest.email}.`,
      emailLogId,
    });
  }

  return NextResponse.json(
    { error: "Statut de demande non supporté" },
    { status: 400 }
  );
}
