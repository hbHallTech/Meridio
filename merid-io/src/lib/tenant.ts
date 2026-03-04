import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

/**
 * Get the current user's companyId from their session.
 * Returns null if not authenticated.
 */
export async function getSessionCompanyId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const companyId = (session.user as any).companyId;
  if (companyId) return companyId;

  // Fallback: look up from DB if not in token yet (backward compat)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { office: { select: { companyId: true } } },
  });
  return user?.office.companyId ?? null;
}

/**
 * Get all officeIds belonging to the current user's company.
 * Useful for scoping queries across a tenant's offices.
 */
export async function getTenantOfficeIds(companyId: string): Promise<string[]> {
  const offices = await prisma.office.findMany({
    where: { companyId },
    select: { id: true },
  });
  return offices.map((o) => o.id);
}

/**
 * Check if the current session belongs to a SUPER_ADMIN.
 */
export async function isSuperAdmin(): Promise<boolean> {
  const session = await auth();
  const roles = (session?.user?.roles ?? []) as UserRole[];
  return roles.includes("SUPER_ADMIN");
}
