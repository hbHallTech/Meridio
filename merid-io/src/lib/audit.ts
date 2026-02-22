import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// ── Audit action types ──────────────────────────────────────────────

export type AuditAction =
  // Auth
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "LOGOUT"
  | "IDLE_LOGOUT"
  | "ACCOUNT_BLOCKED"
  | "NEW_DEVICE"
  // Users
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DEACTIVATED"
  // Leave requests
  | "CREATE_LEAVE"
  | "UPDATE_LEAVE"
  | "LEAVE_SUBMITTED"
  | "LEAVE_CANCELLED"
  // Approvals
  | "MANAGER_APPROVAL_APPROVED"
  | "MANAGER_APPROVAL_REFUSED"
  | "MANAGER_APPROVAL_RETURNED"
  | "HR_APPROVAL_APPROVED"
  | "HR_APPROVAL_REFUSED"
  | "HR_APPROVAL_RETURNED"
  // Files
  | "UPLOAD_ATTACHMENT"
  | "DOWNLOAD_ATTACHMENT"
  // Security
  | "RBAC_DENIED"
  | "PASSWORD_CHANGED"
  | "PASSWORD_RESET"
  | "PASSWORD_AUTO_RESET"
  // Admin
  | "TEAM_CREATED"
  | "TEAM_UPDATED"
  | "TEAM_DELETED"
  | "DELEGATION_CREATED"
  | "DELEGATION_REVOKED"
  | "COMPANY_UPDATED"
  | "COMPANY_LOGO_UPDATED"
  | "OFFICE_CREATED"
  | "OFFICE_UPDATED"
  | "OFFICE_DELETED"
  | "HOLIDAY_CREATED"
  | "HOLIDAY_UPDATED"
  | "HOLIDAY_DELETED"
  | "LEAVE_TYPE_CREATED"
  | "LEAVE_TYPE_UPDATED"
  | "LEAVE_TYPE_DELETED"
  | "CLOSURE_CREATED"
  | "CLOSURE_UPDATED"
  | "CLOSURE_DELETED"
  | "WORKFLOW_DUPLICATED"
  | "EXPORT_AUDIT"
  // Documents
  | "DOCUMENT_CREATED"
  | "DOCUMENT_UPDATED"
  | "DOCUMENT_DELETED"
  | "DOCUMENT_VIEWED"
  | "DOCUMENT_DOWNLOADED"
  // Templates
  | "TEMPLATE_CREATED"
  | "TEMPLATE_UPDATED"
  | "TEMPLATE_DELETED"
  // Auth / 2FA
  | "2FA_CODE_SENT"
  | "2FA_VERIFIED"
  | "2FA_FAILED"
  | "PASSWORD_RESET_REQUESTED"
  // Catch-all for extensions
  | (string & {});

export interface AuditOptions {
  success?: boolean;
  entityType?: string;
  entityId?: string;
  ip?: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
}

/**
 * Log an audit action. Non-blocking — errors are caught and logged
 * to console, never thrown. This ensures audit failures don't crash
 * the main business flow.
 */
export async function logAudit(
  userId: string | null | undefined,
  action: AuditAction,
  options: AuditOptions = {}
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        success: options.success ?? true,
        entityType: options.entityType ?? null,
        entityId: options.entityId ?? null,
        oldValue: options.oldValue ?? undefined,
        newValue: options.newValue ?? undefined,
        ipAddress: options.ip ?? null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[audit] Failed to log action=${action} userId=${userId}: ${msg}`);
  }
}

/**
 * Extract client IP from request headers (Vercel x-forwarded-for).
 */
export function getIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
