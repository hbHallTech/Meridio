import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { sendEmail, sendLeaveRequestNotification } from "@/lib/email";

/** M13: Escape HTML special characters to prevent injection in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
 * Also checks user-level preference if userId is provided.
 */
export async function isNotificationEnabled(type: string, userId?: string): Promise<boolean> {
  try {
    const company = await prisma.company.findFirst({ select: { id: true } });
    if (!company) {
      console.log(`Email notif ${type} : pas de company, activé par défaut`);
      return true;
    }

    const setting = await prisma.companyNotificationSetting.findUnique({
      where: { companyId_type: { companyId: company.id, type } },
    });
    const companyEnabled = setting ? setting.enabled : true;
    console.log(`Email notif ${type} : company toggle=${companyEnabled} (setting exists=${!!setting})`);

    if (!companyEnabled) return false;

    // Check user-level preference
    if (userId) {
      const userPref = await prisma.userNotificationPref.findUnique({
        where: { userId_type: { userId, type } },
      });
      if (userPref && !userPref.enabled) {
        console.log(`Email notif ${type} : user ${userId} a désactivé cette notification`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.log(`Email notif ${type} : erreur vérification toggle, activé par défaut`, error);
    return true;
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
 * Notify the employee that their leave request was submitted successfully.
 */
export async function notifyLeaveSubmitted(
  employeeId: string,
  params: { leaveRequestId: string; leaveType: string; startDate: string; endDate: string; totalDays: number }
) {
  const enabled = await isNotificationEnabled("NEW_REQUEST", employeeId);
  if (!enabled) return;

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { email: true, firstName: true },
  });
  if (!employee) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const safeName = escapeHtml(employee.firstName);
  const safeType = escapeHtml(params.leaveType);
  const safeStart = escapeHtml(params.startDate);
  const safeEnd = escapeHtml(params.endDate);

  const results = await Promise.allSettled([
    createNotification({
      userId: employeeId,
      type: "NEW_REQUEST",
      title_fr: "Demande de conge soumise",
      title_en: "Leave request submitted",
      body_fr: `Votre demande de ${params.leaveType} du ${params.startDate} au ${params.endDate} (${params.totalDays}j) a ete soumise avec succes.`,
      body_en: `Your ${params.leaveType} request from ${params.startDate} to ${params.endDate} (${params.totalDays}d) was submitted successfully.`,
      data: { leaveRequestId: params.leaveRequestId },
    }),
    sendEmail({
      to: employee.email,
      subject: `Meridio - Votre demande de conge a ete soumise`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:'Segoe UI',Arial,sans-serif;background-color:#f4f6f8;margin:0;padding:20px;"><div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><div style="background-color:#1B3A5C;padding:24px;text-align:center;"><h1 style="color:white;margin:0;font-size:24px;">Halley-Technologies</h1><p style="color:#00BCD4;margin:4px 0 0;font-size:14px;">Meridio - Gestion des conges</p></div><div style="padding:32px 24px;"><h2 style="color:#1B3A5C;margin-top:0;">Bonjour ${safeName},</h2><p>Votre demande de conge a ete <strong style="color:#1B3A5C;">soumise avec succes</strong> et est en attente d'approbation.</p><table style="width:100%;border-collapse:collapse;margin:16px 0;"><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Type</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${safeType}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Du</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${safeStart}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Au</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${safeEnd}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Duree</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${params.totalDays} jour(s)</td></tr></table><div style="text-align:center;margin:24px 0;"><a href="${appUrl}/leaves/${encodeURIComponent(params.leaveRequestId)}" style="display:inline-block;background-color:#1B3A5C;color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;">Voir ma demande</a></div></div><div style="background-color:#f8f9fa;padding:16px 24px;text-align:center;font-size:12px;color:#6b7280;"><p style="margin:0;">Cet email a ete envoye automatiquement par Meridio.</p></div></div></body></html>`,
    }),
  ]);

  const emailResult = results[1].status === "fulfilled" ? "success" : "fail";
  console.log(`[notifications] SUBMITTED confirmation to ${employee.email}: ${emailResult}`);

  if (results[1].status === "fulfilled" && results[0].status === "fulfilled") {
    await prisma.notification.update({
      where: { id: results[0].value.id },
      data: { sentByEmail: true },
    }).catch(() => {});
  }
}

/**
 * Notify approvers of a new leave request (in-app + email).
 */
export async function notifyNewLeaveRequest(
  approverIds: string[],
  params: LeaveNotifyParams
) {
  for (const approverId of approverIds) {
    const enabled = await isNotificationEnabled("NEW_REQUEST", approverId);
    if (!enabled) {
      console.log(`Email notif NEW_REQUEST : désactivé pour approver ${approverId}`);
      continue;
    }

    const approver = await prisma.user.findUnique({
      where: { id: approverId },
      select: { email: true, firstName: true },
    });
    if (!approver) {
      console.log(`Email notif NEW_REQUEST : approver ${approverId} introuvable`);
      continue;
    }

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

    const inAppResult = results[0].status === "fulfilled" ? "success" : "fail";
    const emailResult = results[1].status === "fulfilled" ? "success" : "fail";
    const emailError = results[1].status === "rejected" ? ` ${results[1].reason}` : "";
    console.log(`Email notif NEW_REQUEST envoyé à ${approver.email} : in-app=${inAppResult}, email=${emailResult}${emailError}`);

    // Mark notification as sent by email
    if (results[1].status === "fulfilled" && results[0].status === "fulfilled") {
      await prisma.notification.update({
        where: { id: results[0].value.id },
        data: { sentByEmail: true },
      }).catch(() => {});
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
  const enabled = await isNotificationEnabled("APPROVED", employeeId);
  if (!enabled) {
    console.log(`Email notif APPROVED : désactivé pour employee ${employeeId}`);
    return;
  }

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { email: true, firstName: true },
  });
  if (!employee) {
    console.log(`Email notif APPROVED : employee ${employeeId} introuvable`);
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const safeName = escapeHtml(employee.firstName);
  const safeType = escapeHtml(params.leaveType);
  const safeStart = escapeHtml(params.startDate);
  const safeEnd = escapeHtml(params.endDate);
  const safeApprover = escapeHtml(params.approverName);

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
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:'Segoe UI',Arial,sans-serif;background-color:#f4f6f8;margin:0;padding:20px;"><div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><div style="background-color:#1B3A5C;padding:24px;text-align:center;"><h1 style="color:white;margin:0;font-size:24px;">Halley-Technologies</h1><p style="color:#00BCD4;margin:4px 0 0;font-size:14px;">Meridio - Gestion des congés</p></div><div style="padding:32px 24px;"><h2 style="color:#1B3A5C;margin-top:0;">Bonjour ${safeName},</h2><p>Votre demande de congé a été <strong style="color:#16a34a;">approuvée</strong> :</p><table style="width:100%;border-collapse:collapse;margin:16px 0;"><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Type</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${safeType}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Du</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${safeStart}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Au</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${safeEnd}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Approuvé par</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${safeApprover}</td></tr></table><div style="text-align:center;margin:24px 0;"><a href="${appUrl}/leaves" style="display:inline-block;background-color:#16a34a;color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;">Voir mes congés</a></div></div><div style="background-color:#f8f9fa;padding:16px 24px;text-align:center;font-size:12px;color:#6b7280;"><p style="margin:0;">Cet email a été envoyé automatiquement par Meridio.</p></div></div></body></html>`,
    }),
  ]);

  const emailResult = results[1].status === "fulfilled" ? "success" : "fail";
  const emailError = results[1].status === "rejected" ? ` ${results[1].reason}` : "";
  console.log(`Email notif APPROVED envoyé à ${employee.email} : ${emailResult}${emailError}`);

  if (results[1].status === "fulfilled" && results[0].status === "fulfilled") {
    await prisma.notification.update({
      where: { id: results[0].value.id },
      data: { sentByEmail: true },
    }).catch(() => {});
  }
}

/**
 * Notify employee that their leave was refused.
 */
export async function notifyLeaveRejected(
  employeeId: string,
  params: { leaveRequestId: string; leaveType: string; startDate: string; endDate: string; approverName: string; comment: string }
) {
  const enabled = await isNotificationEnabled("REFUSED", employeeId);
  if (!enabled) {
    console.log(`Email notif REFUSED : désactivé pour employee ${employeeId}`);
    return;
  }

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { email: true, firstName: true },
  });
  if (!employee) {
    console.log(`Email notif REFUSED : employee ${employeeId} introuvable`);
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const safeName = escapeHtml(employee.firstName);
  const safeType = escapeHtml(params.leaveType);
  const safeStart = escapeHtml(params.startDate);
  const safeEnd = escapeHtml(params.endDate);
  const safeApprover = escapeHtml(params.approverName);
  const safeComment = escapeHtml(params.comment);

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
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:'Segoe UI',Arial,sans-serif;background-color:#f4f6f8;margin:0;padding:20px;"><div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><div style="background-color:#1B3A5C;padding:24px;text-align:center;"><h1 style="color:white;margin:0;font-size:24px;">Halley-Technologies</h1><p style="color:#00BCD4;margin:4px 0 0;font-size:14px;">Meridio - Gestion des congés</p></div><div style="padding:32px 24px;"><h2 style="color:#1B3A5C;margin-top:0;">Bonjour ${safeName},</h2><p>Votre demande de congé a été <strong style="color:#dc2626;">refusée</strong> :</p><table style="width:100%;border-collapse:collapse;margin:16px 0;"><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Type</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${safeType}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Du</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${safeStart}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Au</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${safeEnd}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Motif de refus</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#dc2626;">${safeComment}</td></tr></table><div style="text-align:center;margin:24px 0;"><a href="${appUrl}/leaves" style="display:inline-block;background-color:#1B3A5C;color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;">Voir mes congés</a></div></div><div style="background-color:#f8f9fa;padding:16px 24px;text-align:center;font-size:12px;color:#6b7280;"><p style="margin:0;">Cet email a été envoyé automatiquement par Meridio.</p></div></div></body></html>`,
    }),
  ]);

  const emailResult = results[1].status === "fulfilled" ? "success" : "fail";
  const emailError = results[1].status === "rejected" ? ` ${results[1].reason}` : "";
  console.log(`Email notif REFUSED envoyé à ${employee.email} : ${emailResult}${emailError}`);

  if (results[1].status === "fulfilled" && results[0].status === "fulfilled") {
    await prisma.notification.update({
      where: { id: results[0].value.id },
      data: { sentByEmail: true },
    }).catch(() => {});
  }
}

/**
 * Notify employee that their leave was returned for revision.
 */
export async function notifyLeaveNeedsRevision(
  employeeId: string,
  params: { leaveRequestId: string; leaveType: string; startDate: string; endDate: string; approverName: string; comment: string }
) {
  const enabled = await isNotificationEnabled("RETURNED", employeeId);
  if (!enabled) {
    console.log(`Email notif RETURNED : désactivé pour employee ${employeeId}`);
    return;
  }

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { email: true, firstName: true },
  });
  if (!employee) {
    console.log(`Email notif RETURNED : employee ${employeeId} introuvable`);
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const safeName = escapeHtml(employee.firstName);
  const safeType = escapeHtml(params.leaveType);
  const safeStart = escapeHtml(params.startDate);
  const safeEnd = escapeHtml(params.endDate);
  const safeApprover = escapeHtml(params.approverName);
  const safeComment = escapeHtml(params.comment);

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
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:'Segoe UI',Arial,sans-serif;background-color:#f4f6f8;margin:0;padding:20px;"><div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><div style="background-color:#1B3A5C;padding:24px;text-align:center;"><h1 style="color:white;margin:0;font-size:24px;">Halley-Technologies</h1><p style="color:#00BCD4;margin:4px 0 0;font-size:14px;">Meridio - Gestion des congés</p></div><div style="padding:32px 24px;"><h2 style="color:#1B3A5C;margin-top:0;">Bonjour ${safeName},</h2><p>Votre demande de congé a été <strong style="color:#d97706;">renvoyée pour modification</strong> :</p><table style="width:100%;border-collapse:collapse;margin:16px 0;"><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Type</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${safeType}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Du</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${safeStart}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Au</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${safeEnd}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Commentaire</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#d97706;">${safeComment}</td></tr></table><div style="text-align:center;margin:24px 0;"><a href="${appUrl}/leaves" style="display:inline-block;background-color:#1B3A5C;color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;">Modifier ma demande</a></div></div><div style="background-color:#f8f9fa;padding:16px 24px;text-align:center;font-size:12px;color:#6b7280;"><p style="margin:0;">Cet email a été envoyé automatiquement par Meridio.</p></div></div></body></html>`,
    }),
  ]);

  const emailResult = results[1].status === "fulfilled" ? "success" : "fail";
  const emailError = results[1].status === "rejected" ? ` ${results[1].reason}` : "";
  console.log(`Email notif RETURNED envoyé à ${employee.email} : ${emailResult}${emailError}`);

  if (results[1].status === "fulfilled" && results[0].status === "fulfilled") {
    await prisma.notification.update({
      where: { id: results[0].value.id },
      data: { sentByEmail: true },
    }).catch(() => {});
  }
}

/**
 * Create an audit log entry.
 * @deprecated Use logAudit() from @/lib/audit instead. Kept for backward compat.
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
  try {
    return await prisma.auditLog.create({
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[audit] Failed: action=${params.action} error=${msg}`);
  }
}

// ─── Security-specific notification helpers ───

export async function notifyAccountLocked(userId: string, minutesLocked: number) {
  const enabled = await isNotificationEnabled("ACCOUNT_LOCKED", userId);
  if (!enabled) return;

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
  const enabled = await isNotificationEnabled("NEW_LOGIN", userId);
  if (!enabled) return;

  return createNotification({
    userId,
    type: "NEW_LOGIN",
    title_fr: "Nouvelle connexion detectee",
    title_en: "New login detected",
    body_fr: `Une connexion depuis un nouvel appareil a ete detectee (IP: ${ip}).`,
    body_en: `A login from a new device was detected (IP: ${ip}).`,
    data: { ip, userAgent },
  });
}

export async function notifyPasswordExpiringSoon(userId: string, daysLeft: number) {
  const enabled = await isNotificationEnabled("PASSWORD_EXPIRING", userId);
  if (!enabled) return;

  return createNotification({
    userId,
    type: "PASSWORD_EXPIRING",
    title_fr: "Mot de passe bientot expire",
    title_en: "Password expiring soon",
    body_fr: `Votre mot de passe expirera dans ${daysLeft} jour(s). Veuillez le changer.`,
    body_en: `Your password will expire in ${daysLeft} day(s). Please change it.`,
  });
}

export async function notifyPasswordAutoReset(userId: string) {
  const enabled = await isNotificationEnabled("PASSWORD_EXPIRING", userId);
  if (!enabled) return;

  return createNotification({
    userId,
    type: "PASSWORD_EXPIRING",
    title_fr: "Mot de passe expire - reinitialise",
    title_en: "Password expired - reset",
    body_fr: "Votre mot de passe a expire et a ete reinitialise automatiquement. Un email contenant votre nouveau mot de passe temporaire vous a ete envoye.",
    body_en: "Your password has expired and was automatically reset. An email with your new temporary password has been sent.",
  });
}

export async function notifyPasswordChanged(userId: string) {
  const enabled = await isNotificationEnabled("PASSWORD_CHANGED", userId);
  if (!enabled) return;

  return createNotification({
    userId,
    type: "PASSWORD_CHANGED",
    title_fr: "Mot de passe modifie",
    title_en: "Password changed",
    body_fr: "Votre mot de passe a ete modifie avec succes.",
    body_en: "Your password has been changed successfully.",
  });
}
