import nodemailer from "nodemailer";

const smtpPort = Number(process.env.SMTP_PORT) || 587;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.office365.com",
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  ...(smtpPort !== 465 && {
    tls: {
      ciphers: "SSLv3",
      rejectUnauthorized: false,
    },
  }),
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  if (!process.env.SMTP_USER) {
    console.log(`[EMAIL SKIP] No SMTP configured. To: ${to}, Subject: ${subject}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}

function emailWrapper(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div style="background-color: #1B3A5C; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Halley-Technologies</h1>
          <p style="color: #00BCD4; margin: 4px 0 0; font-size: 14px;">Meridio - Gestion des congés</p>
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
