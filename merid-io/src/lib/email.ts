import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import frMessages from "@/messages/fr.json";
import enMessages from "@/messages/en.json";

// ─── Locale support ─────────────────────────────────────────────

export type Locale = "fr" | "en";

interface EmailMessages {
  common: { tagline: string; day: string; days: string; type: string; reason: string };
  emails: {
    greeting: string;
    noReplyNotice: string;
    twoFactor: { subject: string; body: string; expiresIn: string };
    passwordReset: {
      subject: string;
      body: string;
      linkLabel: string;
      expiresIn: string;
      ignoreNotice: string;
    };
    passwordChanged: {
      subject: string;
      body: string;
      securityNotice: string;
    };
    leaveRequest: {
      subject: string;
      body: string;
      type: string;
      dates: string;
      action: string;
    };
    leaveReminder: {
      subject: string;
      body: string;
      action: string;
    };
    leaveApproval: {
      subjectApproved: string;
      subjectRefused: string;
      subjectReturned: string;
      bodyApproved: string;
      bodyRefused: string;
      bodyReturned: string;
      commentLabel: string;
    };
    annualClosure: {
      subject: string;
      body: string;
      dates: string;
    };
  };
}

function getEmailMessages(locale: Locale = "fr"): EmailMessages {
  const messages = locale === "en" ? enMessages : frMessages;
  return messages as unknown as EmailMessages;
}

// ─── Dynamic transporter (DB settings → .env fallback) ──────────

let cachedTransporter: Transporter | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

async function getTransporter(): Promise<Transporter> {
  const now = Date.now();
  if (cachedTransporter && now - cacheTimestamp < CACHE_TTL) {
    return cachedTransporter;
  }

  let host = process.env.SMTP_HOST || "smtp.office365.com";
  let port = Number(process.env.SMTP_PORT) || 587;
  let secure = false;
  let user = process.env.SMTP_USER;
  let pass = process.env.SMTP_PASSWORD;

  try {
    const settings = await prisma.notificationSettings.findUnique({ where: { id: 1 } });
    if (settings) {
      if (settings.smtpHost) host = settings.smtpHost;
      if (settings.smtpPort) port = settings.smtpPort;
      secure = settings.smtpSecure;
      if (settings.smtpUser) user = settings.smtpUser;
      if (settings.smtpPassEncrypted) {
        try {
          pass = decrypt(settings.smtpPassEncrypted);
        } catch {
          console.error("[EMAIL] Failed to decrypt SMTP password, falling back to .env");
        }
      }
    }
  } catch {
    // DB not available, use .env defaults
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { ciphers: "SSLv3", rejectUnauthorized: false },
  });

  cacheTimestamp = now;
  return cachedTransporter;
}

/** Reset cache so next sendEmail picks up new settings */
export function resetEmailTransportCache() {
  cachedTransporter = null;
  cacheTimestamp = 0;
}

// ─── Core send ──────────────────────────────────────────────────

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  const transport = await getTransporter();
  const authUser = (transport.options as { auth?: { user?: string } })?.auth?.user;

  if (!authUser) {
    console.log(`[EMAIL SKIP] No SMTP configured. To: ${to}, Subject: ${subject}`);
    return;
  }

  // Resolve "from" dynamically
  let fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER || "";
  try {
    const settings = await prisma.notificationSettings.findUnique({
      where: { id: 1 },
      select: { smtpFrom: true },
    });
    if (settings?.smtpFrom) fromAddr = settings.smtpFrom;
  } catch {
    // fallback
  }

  await transport.sendMail({ from: fromAddr, to, subject, html });
}

// ─── HTML wrapper ───────────────────────────────────────────────

function emailWrapper(content: string, locale: Locale = "fr"): string {
  const t = getEmailMessages(locale);
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div style="background-color: #1B3A5C; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Halley-Technologies</h1>
          <p style="color: #00BCD4; margin: 4px 0 0; font-size: 14px;">${t.common.tagline}</p>
        </div>
        <div style="padding: 32px 24px;">
          ${content}
        </div>
        <div style="background-color: #f8f9fa; padding: 16px 24px; text-align: center; font-size: 12px; color: #6b7280;">
          <p style="margin: 0;">${t.emails.noReplyNotice}</p>
          <p style="margin: 4px 0 0;">Halley-Technologies SA &copy; ${new Date().getFullYear()}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ─── Template functions ─────────────────────────────────────────

export async function send2FACode(to: string, code: string, firstName: string, locale: Locale = "fr") {
  const t = getEmailMessages(locale);
  await sendEmail({
    to,
    subject: t.emails.twoFactor.subject,
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">${t.emails.greeting.replace("{name}", firstName)}</h2>
      <p>${t.emails.twoFactor.body}</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="display: inline-block; background-color: #f0f4f8; border: 2px solid #1B3A5C; border-radius: 8px; padding: 16px 32px; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #1B3A5C;">${code}</span>
      </div>
      <p style="color: #6b7280;">${t.emails.twoFactor.expiresIn}</p>
      <p style="color: #6b7280;">${t.emails.passwordReset.ignoreNotice}</p>
    `, locale),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  firstName: string,
  locale: Locale = "fr"
) {
  const t = getEmailMessages(locale);
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;

  await sendEmail({
    to,
    subject: t.emails.passwordReset.subject,
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">${t.emails.greeting.replace("{name}", firstName)}</h2>
      <p>${t.emails.passwordReset.body}</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${resetUrl}" style="display: inline-block; background-color: #1B3A5C; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">${t.emails.passwordReset.linkLabel}</a>
      </div>
      <p style="color: #6b7280;">${t.emails.passwordReset.expiresIn}</p>
      <p style="color: #6b7280; font-size: 12px;">${t.emails.passwordReset.ignoreNotice}</p>
    `, locale),
  });
}

export async function sendPasswordChangedEmail(to: string, firstName: string, locale: Locale = "fr") {
  const t = getEmailMessages(locale);
  const loginLabel = locale === "en" ? "Sign in" : "Se connecter";
  await sendEmail({
    to,
    subject: t.emails.passwordChanged.subject,
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">${t.emails.greeting.replace("{name}", firstName)}</h2>
      <p>${t.emails.passwordChanged.body}</p>
      <p style="color: #6b7280;">${t.emails.passwordChanged.securityNotice}</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login" style="display: inline-block; background-color: #1B3A5C; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">${loginLabel}</a>
      </div>
    `, locale),
  });
}

export async function sendLeaveRequestNotification(
  managerEmail: string,
  employeeName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  locale: Locale = "fr"
) {
  const t = getEmailMessages(locale);
  const fromLabel = locale === "en" ? "From" : "Du";
  const toLabel = locale === "en" ? "To" : "Au";
  const viewLabel = locale === "en" ? "View request" : "Voir la demande";
  await sendEmail({
    to: managerEmail,
    subject: `[Merid.io] ${t.emails.leaveRequest.subject.replace("{name}", employeeName)}`,
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">${t.emails.leaveRequest.subject.replace("{name}", employeeName)}</h2>
      <p>${t.emails.leaveRequest.body.replace("{name}", `<strong>${employeeName}</strong>`)}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${t.common.type}</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${leaveType}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${fromLabel}</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${startDate}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${toLabel}</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${endDate}</td></tr>
      </table>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/manager/approvals" style="display: inline-block; background-color: #00BCD4; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">${viewLabel}</a>
      </div>
    `, locale),
  });
}

export async function sendLeaveReminderEmail(
  approverEmail: string,
  approverFirstName: string,
  employeeName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  leaveRequestId: string,
  daysPending: number,
  locale: Locale = "fr"
) {
  const t = getEmailMessages(locale);
  const fromLabel = locale === "en" ? "From" : "Du";
  const toLabel = locale === "en" ? "To" : "Au";
  const processLabel = locale === "en" ? "Process request" : "Traiter la demande";
  const daysLabel = daysPending > 1 ? t.common.days : t.common.day;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  await sendEmail({
    to: approverEmail,
    subject: `[Merid.io] ${t.emails.leaveReminder.subject.replace("{name}", employeeName)}`,
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">${t.emails.greeting.replace("{name}", approverFirstName)}</h2>
      <div style="text-align: center; margin: 16px 0;">
        <span style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 50%; background-color: #F59E0B; color: white; font-size: 24px;">&#9200;</span>
      </div>
      <p>${t.emails.leaveReminder.body.replace("{name}", `<strong>${employeeName}</strong>`).replace("{days}", `<strong>${daysPending} ${daysLabel}</strong>`)}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${t.common.type}</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${leaveType}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${fromLabel}</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${startDate}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${toLabel}</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${endDate}</td></tr>
      </table>
      <p style="color: #6b7280;">${t.emails.leaveReminder.action}</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${appUrl}/leaves/${leaveRequestId}" style="display: inline-block; background-color: #F59E0B; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">${processLabel}</a>
      </div>
    `, locale),
  });
}

export async function sendAnnualClosureEmail(
  employeeEmail: string,
  employeeFirstName: string,
  closureReason: string,
  startDate: string,
  endDate: string,
  locale: Locale = "fr"
) {
  const t = getEmailMessages(locale);
  const reasonLabel = t.common.reason;
  const fromLabel = locale === "en" ? "From" : "Du";
  const toLabel = locale === "en" ? "To" : "Au";
  const viewLeavesLabel = locale === "en" ? "View my leaves" : "Voir mes congés";
  const closureNotice = locale === "en"
    ? "A mandatory leave will be automatically created for this period. Please check your leave requests."
    : "Un congé imposé sera automatiquement créé pour cette période. Veuillez vérifier vos demandes de congé.";
  await sendEmail({
    to: employeeEmail,
    subject: `[Merid.io] ${t.emails.annualClosure.subject.replace("{reason}", closureReason)}`,
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">${t.emails.greeting.replace("{name}", employeeFirstName)}</h2>
      <div style="text-align: center; margin: 16px 0;">
        <span style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 50%; background-color: #6366F1; color: white; font-size: 24px;">&#128197;</span>
      </div>
      <p>${t.emails.annualClosure.body}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${reasonLabel}</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${closureReason}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${fromLabel}</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${startDate}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${toLabel}</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${endDate}</td></tr>
      </table>
      <p style="color: #6b7280;">${closureNotice}</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/leaves" style="display: inline-block; background-color: #1B3A5C; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">${viewLeavesLabel}</a>
      </div>
    `, locale),
  });
}

export async function sendLeaveApprovalEmail(
  employeeEmail: string,
  employeeName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  action: "approved" | "refused" | "returned",
  comment?: string,
  locale: Locale = "fr"
) {
  const t = getEmailMessages(locale);
  const firstName = employeeName.split(" ")[0];
  const fromLabel = locale === "en" ? "From" : "Du";
  const toLabel = locale === "en" ? "To" : "Au";
  const viewLabel = locale === "en" ? "View my requests" : "Voir mes demandes";

  const approvalTitles = {
    approved: locale === "en" ? "Request approved" : "Demande approuvée",
    refused: locale === "en" ? "Request refused" : "Demande refusée",
    returned: locale === "en" ? "Request returned to draft" : "Demande renvoyée en brouillon",
  };

  const config = {
    approved: {
      subject: `Meridio - ${t.emails.leaveApproval.subjectApproved}`,
      title: approvalTitles.approved,
      color: "#10B981",
      icon: "&#10004;",
      message: t.emails.leaveApproval.bodyApproved
        .replace("{type}", leaveType)
        .replace("{start}", startDate)
        .replace("{end}", endDate),
    },
    refused: {
      subject: `Meridio - ${t.emails.leaveApproval.subjectRefused}`,
      title: approvalTitles.refused,
      color: "#EF4444",
      icon: "&#10008;",
      message: t.emails.leaveApproval.bodyRefused
        .replace("{type}", leaveType)
        .replace("{start}", startDate)
        .replace("{end}", endDate),
    },
    returned: {
      subject: `Meridio - ${t.emails.leaveApproval.subjectReturned}`,
      title: approvalTitles.returned,
      color: "#F59E0B",
      icon: "&#8635;",
      message: t.emails.leaveApproval.bodyReturned
        .replace("{type}", leaveType)
        .replace("{start}", startDate)
        .replace("{end}", endDate),
    },
  }[action];

  const commentSection = comment
    ? `<div style="margin: 16px 0; padding: 12px 16px; background-color: #FEF3C7; border-left: 4px solid ${config.color}; border-radius: 4px;">
        <p style="margin: 0; font-size: 13px; color: #6b7280;">${t.emails.leaveApproval.commentLabel} :</p>
        <p style="margin: 4px 0 0; font-weight: 600; color: #1F2937;">${comment}</p>
      </div>`
    : "";

  await sendEmail({
    to: employeeEmail,
    subject: config.subject,
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">${t.emails.greeting.replace("{name}", firstName)}</h2>
      <div style="text-align: center; margin: 16px 0;">
        <span style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 50%; background-color: ${config.color}; color: white; font-size: 24px;">${config.icon}</span>
      </div>
      <h3 style="text-align: center; color: ${config.color}; margin: 8px 0 16px;">${config.title}</h3>
      <p>${config.message}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${t.common.type}</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${leaveType}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${fromLabel}</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${startDate}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${toLabel}</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${endDate}</td></tr>
      </table>
      ${commentSection}
      <div style="text-align: center; margin: 24px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/leaves" style="display: inline-block; background-color: #1B3A5C; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">${viewLabel}</a>
      </div>
    `, locale),
  });
}
