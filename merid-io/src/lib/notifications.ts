import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

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
