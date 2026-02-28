import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

/** Escape HTML special characters to prevent injection in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Serverless-safe timeouts (Vercel functions: 10s hobby / 60s pro)
const SMTP_CONNECTION_TIMEOUT = 10_000; // 10s to establish TCP + TLS
const SMTP_GREETING_TIMEOUT = 8_000;   // 8s for SMTP greeting (EHLO)
const SMTP_SOCKET_TIMEOUT = 15_000;    // 15s for write/read on socket

async function getSmtpConfig() {
  try {
    const company = await prisma.company.findFirst({
      select: {
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUser: true,
        smtpPassEncrypted: true,
        smtpFrom: true,
      },
    });

    if (company?.smtpHost && company?.smtpUser) {
      let smtpPass = "";
      if (company.smtpPassEncrypted) {
        try {
          smtpPass = decrypt(company.smtpPassEncrypted);
        } catch {
          smtpPass = company.smtpPassEncrypted;
        }
      }
      return {
        host: company.smtpHost,
        port: company.smtpPort || 587,
        secure: company.smtpSecure,
        user: company.smtpUser,
        pass: smtpPass,
        from: company.smtpFrom || company.smtpUser,
      };
    }
  } catch {
    // DB not available — fall through to env
  }

  // Fallback to .env
  return {
    host: process.env.SMTP_HOST || "smtp.office365.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: (Number(process.env.SMTP_PORT) || 587) === 465,
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
  };
}

/**
 * Create a fresh transporter for each send.
 *
 * Why no caching: On Vercel serverless, containers are frozen/thawed.
 * A cached transporter holds a stale TCP socket that Office 365 has
 * already closed → next write fails with ETIMEDOUT.
 * Fresh connection per send is the only reliable pattern in serverless.
 */
function createTransporter(config: Awaited<ReturnType<typeof getSmtpConfig>>) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure || config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    connectionTimeout: SMTP_CONNECTION_TIMEOUT,
    greetingTimeout: SMTP_GREETING_TIMEOUT,
    socketTimeout: SMTP_SOCKET_TIMEOUT,
    // Use STARTTLS for port 587 (standard). No SSLv3 — use modern ciphers.
    ...(config.port !== 465 && {
      tls: {
        minVersion: "TLSv1.2",
      },
    }),
  });
}

/**
 * Strip HTML tags to produce a plain text version of the email.
 * This is critical for deliverability — HTML-only emails are flagged as spam.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, "  ")
    .replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&copy;/g, "(c)")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  const config = await getSmtpConfig();

  if (!config.user) {
    console.log(`[email] Skip (SMTP non configuré): to=${to} subject="${subject}"`);
    return;
  }

  // Fresh transporter per send — prevents stale socket ETIMEDOUT in serverless
  const transporter = createTransporter(config);
  const text = htmlToPlainText(html);

  try {
    await transporter.sendMail({
      from: config.from,
      to,
      subject,
      html,
      text,
      headers: {
        "X-Mailer": "Meridio HR Platform",
      },
    });
    console.log(`[email] Sent: to=${to} subject="${subject}"`);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[email] Failed: to=${to} subject="${subject}" error=${errMsg}`);
    throw error;
  } finally {
    // Always close the connection — do not leave sockets open in serverless
    transporter.close();
  }
}

function emailWrapper(content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Meridio</title>
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div style="background-color: #1B3A5C; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Halley-Technologies</h1>
          <p style="color: #00BCD4; margin: 4px 0 0; font-size: 14px;">Meridio - Gestion des conges</p>
        </div>
        <div style="padding: 32px 24px;">
          ${content}
        </div>
        <div style="background-color: #f8f9fa; padding: 16px 24px; text-align: center; font-size: 12px; color: #6b7280;">
          <p style="margin: 0;">Cet email a ete envoye automatiquement par Meridio.</p>
          <p style="margin: 4px 0 0;">Halley-Technologies SA - ${new Date().getFullYear()}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function send2FACode(to: string, code: string, firstName: string) {
  await sendEmail({
    to,
    subject: `Meridio - Votre code : ${code}`,
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">Bonjour ${escapeHtml(firstName)},</h2>
      <p>Voici votre code de verification pour acceder a Meridio :</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="display: inline-block; background-color: #f0f4f8; border: 2px solid #1B3A5C; border-radius: 8px; padding: 16px 32px; font-size: 32px; letter-spacing: 4px; font-weight: bold; color: #1B3A5C;">${escapeHtml(code)}</span>
      </div>
      <p style="color: #6b7280;">Ce code expire dans <strong>10 minutes</strong>.</p>
      <p style="color: #6b7280;">Si vous n'avez pas demande ce code, ignorez cet email.</p>
    `),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  firstName: string
) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;

  await sendEmail({
    to,
    subject: "Meridio - Reinitialisation du mot de passe",
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">Bonjour ${escapeHtml(firstName)},</h2>
      <p>Vous avez demande la reinitialisation de votre mot de passe.</p>
      <p>Cliquez sur le bouton ci-dessous pour creer un nouveau mot de passe :</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${resetUrl}" style="display: inline-block; background-color: #1B3A5C; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Reinitialiser mon mot de passe</a>
      </div>
      <p style="color: #6b7280;">Ce lien expire dans <strong>1 heure</strong>.</p>
      <p style="color: #6b7280; font-size: 12px;">Si le bouton ne fonctionne pas, copiez ce lien : ${resetUrl}</p>
    `),
  });
}

export async function sendPasswordChangedEmail(to: string, firstName: string) {
  await sendEmail({
    to,
    subject: "Meridio - Mot de passe modifie",
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">Bonjour ${escapeHtml(firstName)},</h2>
      <p>Votre mot de passe Meridio a ete modifie avec succes.</p>
      <p style="color: #6b7280;">Si vous n'etes pas a l'origine de cette modification, contactez immediatement votre administrateur.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login" style="display: inline-block; background-color: #1B3A5C; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Se connecter</a>
      </div>
    `),
  });
}

export async function sendNewAccountEmail(
  to: string,
  firstName: string,
  tempPassword: string
) {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`;

  await sendEmail({
    to,
    subject: "Meridio - Votre compte a ete cree",
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">Bienvenue ${escapeHtml(firstName)},</h2>
      <p>Votre compte Meridio a ete cree par un administrateur.</p>
      <p>Voici vos identifiants de connexion :</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Email</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${escapeHtml(to)}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Mot de passe</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-family: monospace;">${escapeHtml(tempPassword)}</td></tr>
      </table>
      <p style="color: #EF4444; font-weight: 600;">Vous devrez changer votre mot de passe lors de votre premiere connexion.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${loginUrl}" style="display: inline-block; background-color: #1B3A5C; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Se connecter</a>
      </div>
    `),
  });
}

export async function sendAdminPasswordChangedEmail(
  to: string,
  firstName: string,
  tempPassword: string
) {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`;

  await sendEmail({
    to,
    subject: "Meridio - Votre mot de passe a ete reinitialise",
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">Bonjour ${escapeHtml(firstName)},</h2>
      <p>Votre mot de passe Meridio a ete reinitialise par un administrateur.</p>
      <p>Voici votre nouveau mot de passe temporaire :</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="display: inline-block; background-color: #f0f4f8; border: 2px solid #1B3A5C; border-radius: 8px; padding: 12px 24px; font-size: 18px; font-weight: bold; font-family: monospace; color: #1B3A5C;">${escapeHtml(tempPassword)}</span>
      </div>
      <p style="color: #EF4444; font-weight: 600;">Vous devrez changer votre mot de passe lors de votre prochaine connexion.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${loginUrl}" style="display: inline-block; background-color: #1B3A5C; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Se connecter</a>
      </div>
    `),
  });
}

export async function sendLeaveRequestNotification(
  managerEmail: string,
  employeeName: string,
  leaveType: string,
  startDate: string,
  endDate: string
) {
  const safeName = escapeHtml(employeeName);
  const safeType = escapeHtml(leaveType);
  const safeStart = escapeHtml(startDate);
  const safeEnd = escapeHtml(endDate);
  await sendEmail({
    to: managerEmail,
    subject: `Meridio - Nouvelle demande de conge de ${employeeName}`,
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">Nouvelle demande de conge</h2>
      <p><strong>${safeName}</strong> a soumis une demande de conge :</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Type</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${safeType}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Du</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${safeStart}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Au</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${safeEnd}</td></tr>
      </table>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/manager/approvals" style="display: inline-block; background-color: #00BCD4; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Voir la demande</a>
      </div>
    `),
  });
}

// --- Security Email Templates ---

export async function sendNewDeviceLoginEmail(
  to: string,
  firstName: string,
  ip: string,
  userAgent: string
) {
  const safeName = escapeHtml(firstName);
  const safeIp = escapeHtml(ip);
  const safeUa = escapeHtml(userAgent.substring(0, 100));
  await sendEmail({
    to,
    subject: "Meridio - Nouvelle connexion detectee",
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">Bonjour ${safeName},</h2>
      <p>Une connexion a votre compte Meridio a ete detectee depuis un nouvel appareil :</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Adresse IP</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${safeIp}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Navigateur</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 12px;">${safeUa}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Date</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${new Date().toLocaleString("fr-CH")}</td></tr>
      </table>
      <p style="color: #EF4444; font-weight: 600;">Si vous n'etes pas a l'origine de cette connexion, changez immediatement votre mot de passe et contactez votre administrateur.</p>
    `),
  });
}

export async function sendAccountLockedEmail(
  to: string,
  adminFirstName: string,
  userFullName: string,
  userEmail: string
) {
  const safeAdmin = escapeHtml(adminFirstName);
  const safeUser = escapeHtml(userFullName);
  const safeEmail = escapeHtml(userEmail);
  await sendEmail({
    to,
    subject: `Meridio - Compte verrouille : ${userFullName}`,
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">Bonjour ${safeAdmin},</h2>
      <p>Le compte de <strong>${safeUser}</strong> (${safeEmail}) a ete verrouille suite a 5 tentatives de connexion echouees.</p>
      <p>Le compte sera automatiquement deverrouille dans <strong>15 minutes</strong>.</p>
      <p style="color: #6b7280;">Si cette activite est suspecte, verifiez l'integrite du compte.</p>
    `),
  });
}

export async function sendPasswordExpiringSoonEmail(
  to: string,
  firstName: string,
  daysLeft: number
) {
  const changeUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/profile`;

  await sendEmail({
    to,
    subject: "Meridio - Votre mot de passe expire bientot",
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">Bonjour ${escapeHtml(firstName)},</h2>
      <p>Votre mot de passe Meridio expirera dans <strong>${daysLeft} jour(s)</strong>.</p>
      <p>Veuillez le changer avant son expiration pour eviter une reinitialisation automatique.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${changeUrl}" style="display: inline-block; background-color: #1B3A5C; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Changer mon mot de passe</a>
      </div>
    `),
  });
}

export async function sendPasswordExpiredResetEmail(
  to: string,
  firstName: string,
  tempPassword: string
) {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`;

  await sendEmail({
    to,
    subject: "Meridio - Mot de passe expire et reinitialise",
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">Bonjour ${escapeHtml(firstName)},</h2>
      <p>Votre mot de passe Meridio a expire et a ete reinitialise automatiquement.</p>
      <p>Voici votre nouveau mot de passe temporaire :</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="display: inline-block; background-color: #f0f4f8; border: 2px solid #1B3A5C; border-radius: 8px; padding: 12px 24px; font-size: 18px; font-weight: bold; font-family: monospace; color: #1B3A5C;">${escapeHtml(tempPassword)}</span>
      </div>
      <p style="color: #EF4444; font-weight: 600;">Vous devrez changer votre mot de passe lors de votre prochaine connexion.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${loginUrl}" style="display: inline-block; background-color: #1B3A5C; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Se connecter</a>
      </div>
    `),
  });
}
