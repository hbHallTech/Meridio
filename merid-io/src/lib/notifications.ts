import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { sendEmail, sendLeaveRequestNotification } from "@/lib/email";

interface CreateNotificationParams {
  userId: string;
  type: string;
  title_fr: string;
  title_en: string;
  body_fr: string;
  body_en: string;
  data?: Prisma.InputJsonValue;
}

/**
 * Check if a notification type is enabled at company level.
 */
async function isNotificationEnabled(type: string): Promise<boolean> {
  try {
    const company = await prisma.company.findFirst({ select: { id: true } });
    if (!company) return true; // Default to enabled if no company

    const setting = await prisma.companyNotificationSetting.findUnique({
      where: { companyId_type: { companyId: company.id, type } },
    });
    // If no setting exists, default to enabled
    return setting ? setting.enabled : true;
  } catch (error) {
    console.log("Bug1: Error checking notification toggle:", error);
    return true; // Default to enabled on error
  }
}

/**
 * Create an in-app notification for a user.
 */
export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title_fr: params.title_fr,
      title_en: params.title_en,
      body_fr: params.body_fr,
      body_en: params.body_en,
      data: params.data ?? undefined,
    },
  });
}

// ─── Leave notification helpers (in-app + email via Promise.allSettled) ───

interface LeaveNotifyParams {
  leaveRequestId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
}

/**
 * Notify approvers of a new leave request (in-app + email).
 */
export async function notifyNewLeaveRequest(
  approverIds: string[],
  params: LeaveNotifyParams
) {
  const enabled = await isNotificationEnabled("NEW_REQUEST");
  console.log(`Bug1: notifyNewLeaveRequest enabled=${enabled}, approvers=${approverIds.join(",")}`);
  if (!enabled) return;

  for (const approverId of approverIds) {
    const approver = await prisma.user.findUnique({
      where: { id: approverId },
      select: { email: true, firstName: true },
    });
    if (!approver) continue;

    const results = await Promise.allSettled([
      createNotification({
        userId: approverId,
        type: "NEW_REQUEST",
        title_fr: "Nouvelle demande de congé",
        title_en: "New leave request",
        body_fr: `${params.employeeName} a soumis une demande de ${params.leaveType} du ${params.startDate} au ${params.endDate} (${params.totalDays}j).`,
        body_en: `${params.employeeName} submitted a ${params.leaveType} request from ${params.startDate} to ${params.endDate} (${params.totalDays}d).`,
        data: { leaveRequestId: params.leaveRequestId },
      }),
      sendLeaveRequestNotification(
        approver.email,
        params.employeeName,
        params.leaveType,
        params.startDate,
        params.endDate
      ),
    ]);

    for (const r of results) {
      if (r.status === "rejected") {
        console.log(`Bug1: notifyNewLeaveRequest error for ${approver.email}:`, r.reason);
      }
    }

    // Mark notification as sent by email
    if (results[1].status === "fulfilled") {
      console.log(`Bug1: Email envoyé pour NEW_REQUEST à ${approver.email}`);
      if (results[0].status === "fulfilled") {
        await prisma.notification.update({
          where: { id: results[0].value.id },
          data: { sentByEmail: true },
        }).catch(() => {});
      }
    }
  }
}

/**
 * Notify employee that their leave was approved.
 */
export async function notifyLeaveApproved(
  employeeId: string,
  params: { leaveRequestId: string; leaveType: string; startDate: string; endDate: string; approverName: string }
) {
  const enabled = await isNotificationEnabled("APPROVED");
  console.log(`Bug1: notifyLeaveApproved enabled=${enabled}, employee=${employeeId}`);
  if (!enabled) return;

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { email: true, firstName: true },
  });
  if (!employee) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const results = await Promise.allSettled([
    createNotification({
      userId: employeeId,
      type: "APPROVED",
      title_fr: "Demande de congé approuvée",
      title_en: "Leave request approved",
      body_fr: `Votre demande de ${params.leaveType} du ${params.startDate} au ${params.endDate} a été approuvée par ${params.approverName}.`,
      body_en: `Your ${params.leaveType} request from ${params.startDate} to ${params.endDate} was approved by ${params.approverName}.`,
      data: { leaveRequestId: params.leaveRequestId },
    }),
    sendEmail({
      to: employee.email,
      subject: `Meridio - Votre demande de congé a été approuvée`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:'Segoe UI',Arial,sans-serif;background-color:#f4f6f8;margin:0;padding:20px;"><div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><div style="background-color:#1B3A5C;padding:24px;text-align:center;"><h1 style="color:white;margin:0;font-size:24px;">Halley-Technologies</h1><p style="color:#00BCD4;margin:4px 0 0;font-size:14px;">Meridio - Gestion des congés</p></div><div style="padding:32px 24px;"><h2 style="color:#1B3A5C;margin-top:0;">Bonjour ${employee.firstName},</h2><p>Votre demande de congé a été <strong style="color:#16a34a;">approuvée</strong> :</p><table style="width:100%;border-collapse:collapse;margin:16px 0;"><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Type</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${params.leaveType}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Du</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${params.startDate}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Au</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${params.endDate}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Approuvé par</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${params.approverName}</td></tr></table><div style="text-align:center;margin:24px 0;"><a href="${appUrl}/leaves" style="display:inline-block;background-color:#16a34a;color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;">Voir mes congés</a></div></div><div style="background-color:#f8f9fa;padding:16px 24px;text-align:center;font-size:12px;color:#6b7280;"><p style="margin:0;">Cet email a été envoyé automatiquement par Meridio.</p></div></div></body></html>`,
    }),
  ]);

  for (const r of results) {
    if (r.status === "rejected") {
      console.log(`Bug1: notifyLeaveApproved error for ${employee.email}:`, r.reason);
    }
  }
  if (results[1].status === "fulfilled") {
    console.log(`Bug1: Email envoyé pour APPROVED à ${employee.email}`);
  }
}

/**
 * Notify employee that their leave was refused.
 */
export async function notifyLeaveRejected(
  employeeId: string,
  params: { leaveRequestId: string; leaveType: string; startDate: string; endDate: string; approverName: string; comment: string }
) {
  const enabled = await isNotificationEnabled("REFUSED");
  console.log(`Bug1: notifyLeaveRejected enabled=${enabled}, employee=${employeeId}`);
  if (!enabled) return;

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { email: true, firstName: true },
  });
  if (!employee) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const results = await Promise.allSettled([
    createNotification({
      userId: employeeId,
      type: "REFUSED",
      title_fr: "Demande de congé refusée",
      title_en: "Leave request refused",
      body_fr: `Votre demande de ${params.leaveType} du ${params.startDate} au ${params.endDate} a été refusée par ${params.approverName}. Motif : ${params.comment}`,
      body_en: `Your ${params.leaveType} request from ${params.startDate} to ${params.endDate} was refused by ${params.approverName}. Reason: ${params.comment}`,
      data: { leaveRequestId: params.leaveRequestId },
    }),
    sendEmail({
      to: employee.email,
      subject: `Meridio - Votre demande de congé a été refusée`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:'Segoe UI',Arial,sans-serif;background-color:#f4f6f8;margin:0;padding:20px;"><div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><div style="background-color:#1B3A5C;padding:24px;text-align:center;"><h1 style="color:white;margin:0;font-size:24px;">Halley-Technologies</h1><p style="color:#00BCD4;margin:4px 0 0;font-size:14px;">Meridio - Gestion des congés</p></div><div style="padding:32px 24px;"><h2 style="color:#1B3A5C;margin-top:0;">Bonjour ${employee.firstName},</h2><p>Votre demande de congé a été <strong style="color:#dc2626;">refusée</strong> :</p><table style="width:100%;border-collapse:collapse;margin:16px 0;"><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Type</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${params.leaveType}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Du</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${params.startDate}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Au</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${params.endDate}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Motif de refus</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#dc2626;">${params.comment}</td></tr></table><div style="text-align:center;margin:24px 0;"><a href="${appUrl}/leaves" style="display:inline-block;background-color:#1B3A5C;color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;">Voir mes congés</a></div></div><div style="background-color:#f8f9fa;padding:16px 24px;text-align:center;font-size:12px;color:#6b7280;"><p style="margin:0;">Cet email a été envoyé automatiquement par Meridio.</p></div></div></body></html>`,
    }),
  ]);

  for (const r of results) {
    if (r.status === "rejected") {
      console.log(`Bug1: notifyLeaveRejected error for ${employee.email}:`, r.reason);
    }
  }
  if (results[1].status === "fulfilled") {
    console.log(`Bug1: Email envoyé pour REFUSED à ${employee.email}`);
  }
}

/**
 * Notify employee that their leave was returned for revision.
 */
export async function notifyLeaveNeedsRevision(
  employeeId: string,
  params: { leaveRequestId: string; leaveType: string; startDate: string; endDate: string; approverName: string; comment: string }
) {
  const enabled = await isNotificationEnabled("RETURNED");
  console.log(`Bug1: notifyLeaveNeedsRevision enabled=${enabled}, employee=${employeeId}`);
  if (!enabled) return;

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { email: true, firstName: true },
  });
  if (!employee) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const results = await Promise.allSettled([
    createNotification({
      userId: employeeId,
      type: "RETURNED",
      title_fr: "Demande de congé renvoyée",
      title_en: "Leave request returned",
      body_fr: `Votre demande de ${params.leaveType} du ${params.startDate} au ${params.endDate} a été renvoyée par ${params.approverName}. Motif : ${params.comment}`,
      body_en: `Your ${params.leaveType} request from ${params.startDate} to ${params.endDate} was returned by ${params.approverName}. Reason: ${params.comment}`,
      data: { leaveRequestId: params.leaveRequestId },
    }),
    sendEmail({
      to: employee.email,
      subject: `Meridio - Votre demande de congé nécessite des modifications`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:'Segoe UI',Arial,sans-serif;background-color:#f4f6f8;margin:0;padding:20px;"><div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><div style="background-color:#1B3A5C;padding:24px;text-align:center;"><h1 style="color:white;margin:0;font-size:24px;">Halley-Technologies</h1><p style="color:#00BCD4;margin:4px 0 0;font-size:14px;">Meridio - Gestion des congés</p></div><div style="padding:32px 24px;"><h2 style="color:#1B3A5C;margin-top:0;">Bonjour ${employee.firstName},</h2><p>Votre demande de congé a été <strong style="color:#d97706;">renvoyée pour modification</strong> :</p><table style="width:100%;border-collapse:collapse;margin:16px 0;"><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Type</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${params.leaveType}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Du</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${params.startDate}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Au</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${params.endDate}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Commentaire</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#d97706;">${params.comment}</td></tr></table><div style="text-align:center;margin:24px 0;"><a href="${appUrl}/leaves" style="display:inline-block;background-color:#1B3A5C;color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;">Modifier ma demande</a></div></div><div style="background-color:#f8f9fa;padding:16px 24px;text-align:center;font-size:12px;color:#6b7280;"><p style="margin:0;">Cet email a été envoyé automatiquement par Meridio.</p></div></div></body></html>`,
    }),
  ]);

  for (const r of results) {
    if (r.status === "rejected") {
      console.log(`Bug1: notifyLeaveNeedsRevision error for ${employee.email}:`, r.reason);
    }
  }
  if (results[1].status === "fulfilled") {
    console.log(`Bug1: Email envoyé pour RETURNED à ${employee.email}`);
  }
}

/**
 * Create an audit log entry.
 */
export async function createAuditLog(params: {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  ipAddress?: string;
}) {
  return prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      oldValue: params.oldValue ?? undefined,
      newValue: params.newValue ?? undefined,
      ipAddress: params.ipAddress ?? undefined,
    },
  });
}

// ─── Security-specific notification helpers ───

export async function notifyAccountLocked(userId: string, minutesLocked: number) {
  return createNotification({
    userId,
    type: "ACCOUNT_LOCKED",
    title_fr: "Compte verrouillé",
    title_en: "Account locked",
    body_fr: `Votre compte a été verrouillé pendant ${minutesLocked} minutes suite à trop de tentatives de connexion.`,
    body_en: `Your account has been locked for ${minutesLocked} minutes due to too many login attempts.`,
  });
}

export async function notifyNewLoginDetected(
  userId: string,
  ip: string,
  userAgent: string
) {
  return createNotification({
    userId,
    type: "NEW_LOGIN_DETECTED",
    title_fr: "Nouvelle connexion detectee",
    title_en: "New login detected",
    body_fr: `Une connexion depuis un nouvel appareil a ete detectee (IP: ${ip}).`,
    body_en: `A login from a new device was detected (IP: ${ip}).`,
    data: { ip, userAgent },
  });
}

export async function notifyPasswordExpiringSoon(userId: string, daysLeft: number) {
  return createNotification({
    userId,
    type: "PASSWORD_EXPIRING_SOON",
    title_fr: "Mot de passe bientot expire",
    title_en: "Password expiring soon",
    body_fr: `Votre mot de passe expirera dans ${daysLeft} jour(s). Veuillez le changer.`,
    body_en: `Your password will expire in ${daysLeft} day(s). Please change it.`,
  });
}

export async function notifyPasswordAutoReset(userId: string) {
  return createNotification({
    userId,
    type: "PASSWORD_EXPIRED",
    title_fr: "Mot de passe expire - reinitialise",
    title_en: "Password expired - reset",
    body_fr: "Votre mot de passe a expire et a ete reinitialise automatiquement. Un email contenant votre nouveau mot de passe temporaire vous a ete envoye.",
    body_en: "Your password has expired and was automatically reset. An email with your new temporary password has been sent.",
  });
}

export async function notifyPasswordChanged(userId: string) {
  return createNotification({
    userId,
    type: "PASSWORD_CHANGED",
    title_fr: "Mot de passe modifie",
    title_en: "Password changed",
    body_fr: "Votre mot de passe a ete modifie avec succes.",
    body_en: "Your password has been changed successfully.",
  });
}
