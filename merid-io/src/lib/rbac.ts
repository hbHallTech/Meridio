import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

interface SessionUser {
  id?: string;
  roles?: UserRole[];
}

/**
 * Verify that the session user has at least one of the required roles.
 * Returns a 403 NextResponse if unauthorized, or null if OK.
 *
 * Usage:
 *   const denied = requireRoles(session?.user, "MANAGER", "ADMIN");
 *   if (denied) return denied;
 */
export function requireRoles(
  user: SessionUser | undefined | null,
  ...requiredRoles: UserRole[]
): NextResponse | null {
  if (!user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const userRoles = user.roles ?? [];
  if (!requiredRoles.some((r) => userRoles.includes(r))) {
    console.warn(
      `[RBAC] Access denied: user=${user.id} roles=[${userRoles}] required=[${requiredRoles}]`
    );
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }
  return null;
}

/**
 * Verify that the current user is a manager of the team that owns the leave request.
 * This prevents a MANAGER of Team A from approving leaves of Team B.
 *
 * Returns a 403 NextResponse if not authorized, or null if OK.
 * ADMIN role bypasses this check.
 */
export async function requireManagerOfLeave(
  user: SessionUser | undefined | null,
  leaveRequestId: string
): Promise<NextResponse | null> {
  if (!user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = user.roles ?? [];

  // ADMIN bypasses team ownership check
  if (userRoles.includes("ADMIN")) {
    return null;
  }

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    select: {
      user: { select: { teamId: true } },
    },
  });

  if (!leaveRequest) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }

  const requesterTeamId = leaveRequest.user.teamId;
  if (!requesterTeamId) {
    console.warn(`[RBAC] Leave ${leaveRequestId}: requester has no team, cannot verify manager ownership`);
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  // Check that current user manages the requester's team
  const team = await prisma.team.findUnique({
    where: { id: requesterTeamId },
    select: { managerId: true },
  });

  if (team?.managerId !== user.id) {
    console.warn(
      `[RBAC] Manager ownership denied: user=${user.id} is not manager of team=${requesterTeamId} (manager=${team?.managerId}), leaveRequest=${leaveRequestId}`
    );
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  return null;
}

/**
 * Verify that the current user is either HR assigned to the approval step,
 * or an ADMIN. This prevents random HR users from approving if not assigned.
 *
 * Returns a 403 NextResponse if not authorized, or null if OK.
 */
export async function requireHrApproverOfLeave(
  user: SessionUser | undefined | null,
  leaveRequestId: string
): Promise<NextResponse | null> {
  if (!user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = user.roles ?? [];

  // ADMIN bypasses
  if (userRoles.includes("ADMIN")) {
    return null;
  }

  // Check that the current user is assigned as HR approver on this leave
  const assignedStep = await prisma.approvalStep.findFirst({
    where: {
      leaveRequestId,
      approverId: user.id,
      stepType: "HR",
      action: null,
    },
  });

  if (!assignedStep) {
    console.warn(
      `[RBAC] HR approval denied: user=${user.id} is not an assigned HR approver for leaveRequest=${leaveRequestId}`
    );
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  return null;
}
