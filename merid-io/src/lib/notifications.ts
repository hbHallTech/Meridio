import { prisma } from "@/lib/prisma";
import type { Prisma, NotificationSettings } from "@prisma/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  sendLeaveRequestNotification,
  sendLeaveApprovalEmail,
  sendLeaveReminderEmail,
  sendAnnualClosureEmail,
  sendPasswordChangedEmail,
} from "@/lib/email";

// ─── Helpers ──────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return format(date, "dd/MM/yyyy", { locale: fr });
}

type ToggleKey = keyof Pick<
  NotificationSettings,
  | "notifyNewLeaveRequest"
  | "notifyLeaveApproved"
  | "notifyLeaveRejected"
  | "notifyLeaveNeedsRevision"
  | "notifyLeaveReminder"
  | "notifyAnnualClosure"
  | "notifyPasswordChanged"
>;

async function isToggleEnabled(toggleName: ToggleKey): Promise<boolean> {
  try {
    const settings = await prisma.notificationSettings.findUnique({ where: { id: 1 } });
    if (!settings) return true; // No settings row → default enabled
    return settings[toggleName];
  } catch {
    return true; // DB error → default enabled
  }
}

async function createNotification(params: {
  userId: string;
  type: string;
  title_fr: string;
  title_en: string;
  body_fr: string;
  body_en: string;
  link?: string;
  data?: Prisma.InputJsonValue;
  sentByEmail?: boolean;
}) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title_fr: params.title_fr,
      title_en: params.title_en,
      body_fr: params.body_fr,
      body_en: params.body_en,
      link: params.link ?? null,
      data: params.data ?? undefined,
      sentByEmail: params.sentByEmail ?? false,
    },
  });
}

// ─── notifyNewLeaveRequest ───────────────────────────────────────

export async function notifyNewLeaveRequest(leaveRequestId: string) {
  if (!(await isToggleEnabled("notifyNewLeaveRequest"))) return;

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: {
      user: { select: { firstName: true, lastName: true, teamId: true } },
      leaveTypeConfig: { select: { label_fr: true, label_en: true } },
      approvalSteps: {
        where: { action: null },
        orderBy: { stepOrder: "asc" },
        take: 1,
        include: { approver: { select: { id: true, email: true, firstName: true } } },
      },
    },
  });

  if (!leave || leave.approvalSteps.length === 0) return;

  const step = leave.approvalSteps[0];
  const employeeName = `${leave.user.firstName} ${leave.user.lastName}`;
  const typeFr = leave.leaveTypeConfig.label_fr;
  const typeEn = leave.leaveTypeConfig.label_en;
  const start = formatDate(leave.startDate);
  const end = formatDate(leave.endDate);

  const results = await Promise.allSettled([
    createNotification({
      userId: step.approver.id,
      type: "NEW_REQUEST",
      title_fr: `Nouvelle demande de ${employeeName}`,
      title_en: `New request from ${employeeName}`,
      body_fr: `${typeFr} du ${start} au ${end} (${leave.totalDays}j)`,
      body_en: `${typeEn} from ${start} to ${end} (${leave.totalDays}d)`,
      link: `/leaves/${leaveRequestId}`,
      data: { leaveRequestId },
      sentByEmail: true,
    }),
    sendLeaveRequestNotification(
      step.approver.email,
      employeeName,
      typeFr,
      start,
      end
    ),
  ]);

  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[NOTIFY] notifyNewLeaveRequest error:", r.reason);
    }
  }
}

// ─── notifyLeaveApproved ────────────────────────────────────────

export async function notifyLeaveApproved(leaveRequestId: string) {
  if (!(await isToggleEnabled("notifyLeaveApproved"))) return;

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
      leaveTypeConfig: { select: { label_fr: true, label_en: true } },
    },
  });

  if (!leave) return;

  const employeeName = `${leave.user.firstName} ${leave.user.lastName}`;
  const start = formatDate(leave.startDate);
  const end = formatDate(leave.endDate);

  const results = await Promise.allSettled([
    createNotification({
      userId: leave.user.id,
      type: "APPROVED",
      title_fr: "Demande approuvée",
      title_en: "Request approved",
      body_fr: `Votre ${leave.leaveTypeConfig.label_fr} du ${start} au ${end} a été approuvée.`,
      body_en: `Your ${leave.leaveTypeConfig.label_en} from ${start} to ${end} has been approved.`,
      link: `/leaves/${leaveRequestId}`,
      data: { leaveRequestId },
      sentByEmail: true,
    }),
    sendLeaveApprovalEmail(
      leave.user.email,
      employeeName,
      leave.leaveTypeConfig.label_fr,
      start,
      end,
      "approved"
    ),
  ]);

  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[NOTIFY] notifyLeaveApproved error:", r.reason);
    }
  }
}

// ─── notifyLeaveRejected ────────────────────────────────────────

export async function notifyLeaveRejected(
  leaveRequestId: string,
  comment?: string
) {
  if (!(await isToggleEnabled("notifyLeaveRejected"))) return;

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
      leaveTypeConfig: { select: { label_fr: true, label_en: true } },
    },
  });

  if (!leave) return;

  const employeeName = `${leave.user.firstName} ${leave.user.lastName}`;
  const start = formatDate(leave.startDate);
  const end = formatDate(leave.endDate);

  const results = await Promise.allSettled([
    createNotification({
      userId: leave.user.id,
      type: "REFUSED",
      title_fr: "Demande refusée",
      title_en: "Request refused",
      body_fr: `Votre ${leave.leaveTypeConfig.label_fr} du ${start} au ${end} a été refusée.${comment ? ` Motif : ${comment}` : ""}`,
      body_en: `Your ${leave.leaveTypeConfig.label_en} from ${start} to ${end} has been refused.${comment ? ` Reason: ${comment}` : ""}`,
      link: `/leaves/${leaveRequestId}`,
      data: { leaveRequestId },
      sentByEmail: true,
    }),
    sendLeaveApprovalEmail(
      leave.user.email,
      employeeName,
      leave.leaveTypeConfig.label_fr,
      start,
      end,
      "refused",
      comment
    ),
  ]);

  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[NOTIFY] notifyLeaveRejected error:", r.reason);
    }
  }
}

// ─── notifyLeaveNeedsRevision ───────────────────────────────────

export async function notifyLeaveNeedsRevision(
  leaveRequestId: string,
  comment?: string
) {
  if (!(await isToggleEnabled("notifyLeaveNeedsRevision"))) return;

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
      leaveTypeConfig: { select: { label_fr: true, label_en: true } },
    },
  });

  if (!leave) return;

  const employeeName = `${leave.user.firstName} ${leave.user.lastName}`;
  const start = formatDate(leave.startDate);
  const end = formatDate(leave.endDate);

  const results = await Promise.allSettled([
    createNotification({
      userId: leave.user.id,
      type: "RETURNED",
      title_fr: "Demande renvoyée pour modification",
      title_en: "Request returned for revision",
      body_fr: `Votre ${leave.leaveTypeConfig.label_fr} du ${start} au ${end} nécessite des modifications.${comment ? ` Motif : ${comment}` : ""}`,
      body_en: `Your ${leave.leaveTypeConfig.label_en} from ${start} to ${end} needs revision.${comment ? ` Reason: ${comment}` : ""}`,
      link: `/leaves/${leaveRequestId}`,
      data: { leaveRequestId },
      sentByEmail: true,
    }),
    sendLeaveApprovalEmail(
      leave.user.email,
      employeeName,
      leave.leaveTypeConfig.label_fr,
      start,
      end,
      "returned",
      comment
    ),
  ]);

  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[NOTIFY] notifyLeaveNeedsRevision error:", r.reason);
    }
  }
}

// ─── notifyLeaveReminder ────────────────────────────────────────

export async function notifyLeaveReminder(leaveRequestId: string) {
  if (!(await isToggleEnabled("notifyLeaveReminder"))) return;

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: {
      user: { select: { firstName: true, lastName: true } },
      leaveTypeConfig: { select: { label_fr: true, label_en: true } },
      approvalSteps: {
        where: { action: null },
        orderBy: { stepOrder: "asc" },
        take: 1,
        include: { approver: { select: { id: true, email: true, firstName: true } } },
      },
    },
  });

  if (!leave || leave.approvalSteps.length === 0) return;

  const step = leave.approvalSteps[0];
  const employeeName = `${leave.user.firstName} ${leave.user.lastName}`;
  const start = formatDate(leave.startDate);
  const end = formatDate(leave.endDate);
  const daysPending = Math.floor(
    (Date.now() - leave.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Check for active delegation
  const now = new Date();
  const delegation = await prisma.delegation.findFirst({
    where: {
      fromUserId: step.approver.id,
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include: { toUser: { select: { id: true, email: true, firstName: true } } },
  });

  const target = delegation ? delegation.toUser : step.approver;

  const results = await Promise.allSettled([
    createNotification({
      userId: target.id,
      type: "REMINDER",
      title_fr: `Rappel : demande en attente de ${employeeName}`,
      title_en: `Reminder: pending request from ${employeeName}`,
      body_fr: `${leave.leaveTypeConfig.label_fr} du ${start} au ${end} — en attente depuis ${daysPending}j`,
      body_en: `${leave.leaveTypeConfig.label_en} from ${start} to ${end} — pending for ${daysPending}d`,
      link: `/leaves/${leaveRequestId}`,
      data: { leaveRequestId },
      sentByEmail: true,
    }),
    sendLeaveReminderEmail(
      target.email,
      target.firstName,
      employeeName,
      leave.leaveTypeConfig.label_fr,
      start,
      end,
      leaveRequestId,
      daysPending
    ),
  ]);

  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[NOTIFY] notifyLeaveReminder error:", r.reason);
    }
  }
}

// ─── notifyAnnualClosure ────────────────────────────────────────

export async function notifyAnnualClosure(
  userIds: string[],
  closureReason: string,
  startDate: Date,
  endDate: Date
) {
  if (!(await isToggleEnabled("notifyAnnualClosure"))) return;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, isActive: true },
    select: { id: true, email: true, firstName: true, language: true },
  });

  const start = formatDate(startDate);
  const end = formatDate(endDate);

  const promises = users.flatMap((user) => [
    createNotification({
      userId: user.id,
      type: "CLOSURE",
      title_fr: "Fermeture annuelle planifiée",
      title_en: "Annual closure scheduled",
      body_fr: `${closureReason} — du ${start} au ${end}`,
      body_en: `${closureReason} — from ${start} to ${end}`,
      link: "/leaves",
      sentByEmail: true,
    }),
    sendAnnualClosureEmail(
      user.email,
      user.firstName,
      closureReason,
      start,
      end
    ),
  ]);

  const results = await Promise.allSettled(promises);
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[NOTIFY] notifyAnnualClosure error:", r.reason);
    }
  }
}

// ─── notifyPasswordChanged ──────────────────────────────────────

export async function notifyPasswordChanged(userId: string) {
  if (!(await isToggleEnabled("notifyPasswordChanged"))) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true },
  });

  if (!user) return;

  const results = await Promise.allSettled([
    createNotification({
      userId: user.id,
      type: "PASSWORD_CHANGED",
      title_fr: "Mot de passe modifié",
      title_en: "Password changed",
      body_fr: "Votre mot de passe a été modifié avec succès.",
      body_en: "Your password has been changed successfully.",
      link: "/profile",
    }),
    sendPasswordChangedEmail(user.email, user.firstName),
  ]);

  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[NOTIFY] notifyPasswordChanged error:", r.reason);
    }
  }
}
