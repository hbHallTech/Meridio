import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import crypto from "crypto";
import type { UserRole } from "@prisma/client";

/**
 * POST /api/super-admin/impersonate
 *
 * Generates a one-time impersonation token for a target user.
 * The super admin can then use this token to log in as that user
 * via the standard reset-password flow (the token sets a temp password
 * and redirects to the dashboard).
 *
 * Security:
 * - Only SUPER_ADMIN can call this
 * - Target user must exist and be active
 * - Token expires in 5 minutes
 * - Action is fully audited
 */
export async function POST(request: Request) {
  const session = await auth();
  const roles = (session?.user?.roles ?? []) as UserRole[];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { userId } = body;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId requis" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      roles: true,
    },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  if (!targetUser.isActive) {
    return NextResponse.json(
      { error: "Impossible d'impersonner un utilisateur désactivé" },
      { status: 400 }
    );
  }

  // Cannot impersonate another SUPER_ADMIN
  if (targetUser.roles.includes("SUPER_ADMIN")) {
    return NextResponse.json(
      { error: "Impossible d'impersonner un autre Super Admin" },
      { status: 403 }
    );
  }

  // Generate a short-lived reset token for impersonation
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await prisma.user.update({
    where: { id: userId },
    data: {
      resetPasswordToken: tokenHash,
      resetPasswordExpiry: expiry,
    },
  });

  // Audit this action
  void logAudit(session!.user!.id, "IMPERSONATE_USER", {
    entityType: "User",
    entityId: userId,
    newValue: {
      targetEmail: targetUser.email,
      targetName: `${targetUser.firstName} ${targetUser.lastName}`,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return NextResponse.json({
    success: true,
    impersonateUrl: `${appUrl}/reset-password?token=${token}&impersonate=true`,
    expiresIn: "5 minutes",
    targetUser: {
      id: targetUser.id,
      email: targetUser.email,
      name: `${targetUser.firstName} ${targetUser.lastName}`,
    },
  });
}
