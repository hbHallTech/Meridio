import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import crypto from "crypto";
import type { UserRole } from "@prisma/client";

/**
 * Default impersonation TTL in minutes.
 * Override with IMPERSONATE_TTL_MINUTES env var.
 */
const DEFAULT_TTL_MINUTES = 15;

function getImpersonateTtlMs(): number {
  const envTtl = process.env.IMPERSONATE_TTL_MINUTES;
  const minutes = envTtl ? Math.max(1, Math.min(60, Number(envTtl))) : DEFAULT_TTL_MINUTES;
  return minutes * 60 * 1000;
}

/**
 * POST /api/super-admin/impersonate
 *
 * Generates a one-time impersonation token for a target tenant admin.
 *
 * Body:
 *   - companyId: string (required) — target company to impersonate
 *   - userId?: string — specific user; if omitted, picks the first active ADMIN
 *   - readOnly?: boolean — if true, marks the session for read-only access
 *
 * Security:
 * - Only SUPER_ADMIN can call this
 * - Cannot impersonate another SUPER_ADMIN
 * - Target user must exist and be active
 * - TTL configurable via env (default 15 min)
 * - Action is fully audited with issuedAt/expiresAt
 */
export async function POST(request: Request) {
  const session = await auth();
  const roles = (session?.user?.roles ?? []) as UserRole[];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { companyId, userId, readOnly } = body;

  if (!companyId || typeof companyId !== "string") {
    return NextResponse.json({ error: "companyId requis" }, { status: 400 });
  }

  // Validate company exists
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });

  if (!company) {
    return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
  }

  // Find target user
  let targetUser;
  if (userId && typeof userId === "string") {
    // Specific user requested — validate they belong to this company
    targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        office: { companyId },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        roles: true,
      },
    });
  } else {
    // Pick the first active ADMIN of the company
    targetUser = await prisma.user.findFirst({
      where: {
        office: { companyId },
        isActive: true,
        roles: { has: "ADMIN" },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        roles: true,
      },
    });
  }

  if (!targetUser) {
    return NextResponse.json(
      { error: "Aucun utilisateur admin actif trouvé pour cette entreprise" },
      { status: 404 }
    );
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

  // Generate impersonation token
  const ttlMs = getImpersonateTtlMs();
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const issuedAt = new Date();
  const expiry = new Date(Date.now() + ttlMs);

  await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      resetPasswordToken: tokenHash,
      resetPasswordExpiry: expiry,
    },
  });

  const ttlMinutes = Math.round(ttlMs / 60_000);

  // Full audit trail
  void logAudit(session!.user!.id, "IMPERSONATE_USER", {
    entityType: "User",
    entityId: targetUser.id,
    newValue: {
      targetEmail: targetUser.email,
      targetName: `${targetUser.firstName} ${targetUser.lastName}`,
      companyId: company.id,
      companyName: company.name,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiry.toISOString(),
      ttlMinutes,
      readOnly: !!readOnly,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const impersonateUrl = `${appUrl}/reset-password?token=${token}&impersonate=true${readOnly ? "&readOnly=true" : ""}`;

  return NextResponse.json({
    success: true,
    impersonateUrl,
    expiresIn: `${ttlMinutes} minutes`,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiry.toISOString(),
    readOnly: !!readOnly,
    targetUser: {
      id: targetUser.id,
      email: targetUser.email,
      name: `${targetUser.firstName} ${targetUser.lastName}`,
    },
    company: {
      id: company.id,
      name: company.name,
    },
  });
}
