import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

// Cached transporter (rebuilt when DB config changes)
let _transporter: Transporter | null = null;
let _lastConfigHash = "";

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

async function getTransporter(): Promise<Transporter> {
  const config = await getSmtpConfig();
  const configHash = `${config.host}:${config.port}:${config.user}:${config.secure}`;

  if (_transporter && configHash === _lastConfigHash) {
    return _transporter;
  }

  _transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure || config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    ...(config.port !== 465 && {
      tls: {
        ciphers: "SSLv3",
        rejectUnauthorized: false,
      },
    }),
  });

  _lastConfigHash = configHash;
  return _transporter;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  const config = await getSmtpConfig();

  if (!config.user) {
    console.log(`[EMAIL SKIP] No SMTP configured. To: ${to}, Subject: ${subject}`);
    return;
  }

  const transporter = await getTransporter();

  await transporter.sendMail({
    from: config.from,
    to,
    subject,
    html,
  });
}

// Meridio logo as base64 data URI (works in all email clients)
const MERIDIO_LOGO_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 32" fill="none"><path d="M3 20C7 20 10 8 18 8C26 8 26 26 34 26C39 26 41 18 41 18" stroke="url(#eg)" stroke-width="2.8" stroke-linecap="round" fill="none"/><circle cx="18" cy="16" r="5" fill="#00d3a7" opacity=".15"/><circle cx="18" cy="16" r="3" fill="#00d3a7"/><circle cx="18" cy="16" r="1" fill="#fff"/><text x="52" y="23" font-family="Inter,system-ui,-apple-system,sans-serif" font-size="21" font-weight="700" fill="#ffffff" letter-spacing="-.3">Meridio</text><defs><linearGradient id="eg" x1="3" y1="16" x2="41" y2="16" gradientUnits="userSpaceOnUse"><stop stop-color="#2c90ff"/><stop offset="1" stop-color="#00d3a7"/></linearGradient></defs></svg>`).toString("base64")}`;

function emailWrapper(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div style="background-color: #0b2540; padding: 28px 24px; text-align: center;">
          <img src="${MERIDIO_LOGO_DATA_URI}" alt="Meridio" width="180" height="24" style="display: inline-block;" />
          <p style="color: rgba(255,255,255,0.5); margin: 8px 0 0; font-size: 12px;">Gestion des congés &amp; notes de frais</p>
        </div>
        <div style="padding: 32px 24px;">
          ${content}
        </div>
        <div style="background-color: #f8f9fa; padding: 16px 24px; text-align: center; font-size: 12px; color: #6b7280;">
          <p style="margin: 0;">Cet email a été envoyé automatiquement par Meridio.</p>
          <p style="margin: 4px 0 0;">Halley-Technologies SA &copy; ${new Date().getFullYear()}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function send2FACode(to: string, code: string, firstName: string) {
  await sendEmail({
    to,
    subject: "Meridio - Code de vérification",
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">Bonjour ${firstName},</h2>
      <p>Voici votre code de vérification pour accéder à Meridio :</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="display: inline-block; background-color: #f0f4f8; border: 2px solid #1B3A5C; border-radius: 8px; padding: 16px 32px; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #1B3A5C;">${code}</span>
      </div>
      <p style="color: #6b7280;">Ce code expire dans <strong>10 minutes</strong>.</p>
      <p style="color: #6b7280;">Si vous n'avez pas demandé ce code, ignorez cet email.</p>
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
    subject: "Meridio - Réinitialisation du mot de passe",
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">Bonjour ${firstName},</h2>
      <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
      <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${resetUrl}" style="display: inline-block; background-color: #1B3A5C; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Réinitialiser mon mot de passe</a>
      </div>
      <p style="color: #6b7280;">Ce lien expire dans <strong>1 heure</strong>.</p>
      <p style="color: #6b7280; font-size: 12px;">Si le bouton ne fonctionne pas, copiez ce lien : ${resetUrl}</p>
    `),
  });
}

export async function sendPasswordChangedEmail(to: string, firstName: string) {
  await sendEmail({
    to,
    subject: "Meridio - Mot de passe modifié",
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">Bonjour ${firstName},</h2>
      <p>Votre mot de passe Meridio a été modifié avec succès.</p>
      <p style="color: #6b7280;">Si vous n'êtes pas à l'origine de cette modification, contactez immédiatement votre administrateur.</p>
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
    subject: "Meridio - Votre compte a été créé",
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">Bienvenue ${firstName},</h2>
      <p>Votre compte Meridio a été créé par un administrateur.</p>
      <p>Voici vos identifiants de connexion :</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Email</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${to}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Mot de passe</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-family: monospace;">${tempPassword}</td></tr>
      </table>
      <p style="color: #EF4444; font-weight: 600;">Vous devrez changer votre mot de passe lors de votre première connexion.</p>
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
    subject: "Meridio - Votre mot de passe a été réinitialisé",
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">Bonjour ${firstName},</h2>
      <p>Votre mot de passe Meridio a été réinitialisé par un administrateur.</p>
      <p>Voici votre nouveau mot de passe temporaire :</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="display: inline-block; background-color: #f0f4f8; border: 2px solid #1B3A5C; border-radius: 8px; padding: 12px 24px; font-size: 18px; font-weight: bold; font-family: monospace; color: #1B3A5C;">${tempPassword}</span>
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
  await sendEmail({
    to: managerEmail,
    subject: `Meridio - Nouvelle demande de congé de ${employeeName}`,
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">Nouvelle demande de congé</h2>
      <p><strong>${employeeName}</strong> a soumis une demande de congé :</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Type</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${leaveType}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Du</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${startDate}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Au</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${endDate}</td></tr>
      </table>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/manager/approvals" style="display: inline-block; background-color: #00BCD4; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Voir la demande</a>
      </div>
    `),
  });
}

// ─── Security Email Templates ───────────────────────────────────────────────

export async function sendNewDeviceLoginEmail(
  to: string,
  firstName: string,
  ip: string,
  userAgent: string
) {
  await sendEmail({
    to,
    subject: "Meridio - Nouvelle connexion detectee",
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">Bonjour ${firstName},</h2>
      <p>Une connexion a votre compte Meridio a ete detectee depuis un nouvel appareil :</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Adresse IP</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${ip}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Navigateur</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 12px;">${userAgent.substring(0, 100)}</td></tr>
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
  await sendEmail({
    to,
    subject: `Meridio - Compte verrouille : ${userFullName}`,
    html: emailWrapper(`
      <h2 style="color: #1B3A5C; margin-top: 0;">Bonjour ${adminFirstName},</h2>
      <p>Le compte de <strong>${userFullName}</strong> (${userEmail}) a ete verrouille suite a 5 tentatives de connexion echouees.</p>
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
      <h2 style="color: #1B3A5C; margin-top: 0;">Bonjour ${firstName},</h2>
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
      <h2 style="color: #1B3A5C; margin-top: 0;">Bonjour ${firstName},</h2>
      <p>Votre mot de passe Meridio a expire et a ete reinitialise automatiquement.</p>
      <p>Voici votre nouveau mot de passe temporaire :</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="display: inline-block; background-color: #f0f4f8; border: 2px solid #1B3A5C; border-radius: 8px; padding: 12px 24px; font-size: 18px; font-weight: bold; font-family: monospace; color: #1B3A5C;">${tempPassword}</span>
      </div>
      <p style="color: #EF4444; font-weight: 600;">Vous devrez changer votre mot de passe lors de votre prochaine connexion.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${loginUrl}" style="display: inline-block; background-color: #1B3A5C; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Se connecter</a>
      </div>
    `),
  });
}
