/**
 * Email HTML templates for the email queue.
 *
 * These functions build the full HTML string that gets stored in EmailLog.payload.
 * Extracting them from email.ts allows the queue to store and resend emails
 * without re-importing the full Nodemailer stack.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export function buildTenantWelcomeHtml(
  firstName: string,
  companyName: string,
  resetToken: string,
  adminEmail: string
): string {
  const resetUrl = `${appUrl()}/reset-password?token=${resetToken}`;

  return emailWrapper(`
    <h2 style="color: #1B3A5C; margin-top: 0;">Bienvenue sur Meridio, ${escapeHtml(firstName)} !</h2>
    <p>Votre espace <strong>${escapeHtml(companyName)}</strong> a ete cree avec succes.</p>
    <p>Vous etes l'administrateur principal de votre organisation. Pour commencer, definissez votre mot de passe en cliquant sur le bouton ci-dessous :</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${resetUrl}" style="display: inline-block; background-color: #00BCD4; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Definir mon mot de passe</a>
    </div>
    <p style="color: #6b7280;">Ce lien expire dans <strong>24 heures</strong>.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background: #f8fafc; border-radius: 8px;">
      <tr><td style="padding: 12px 16px; color: #6b7280;">Email de connexion</td><td style="padding: 12px 16px; font-weight: 600;">${escapeHtml(adminEmail)}</td></tr>
      <tr><td style="padding: 12px 16px; color: #6b7280;">Organisation</td><td style="padding: 12px 16px; font-weight: 600;">${escapeHtml(companyName)}</td></tr>
      <tr><td style="padding: 12px 16px; color: #6b7280;">Role</td><td style="padding: 12px 16px; font-weight: 600;">Administrateur</td></tr>
    </table>
    <p style="color: #6b7280; font-size: 13px;">Apres avoir defini votre mot de passe, vous pourrez configurer vos bureaux, equipes, types de conges et inviter vos collaborateurs.</p>
  `);
}

export function buildSignupRejectionHtml(
  firstName: string,
  companyName: string,
  notes?: string | null
): string {
  const contactUrl = `${appUrl()}/#contact`;

  const notesHtml = notes
    ? `<div style="margin: 16px 0; padding: 12px 16px; background: #fef2f2; border-left: 4px solid #EF4444; border-radius: 4px;">
        <p style="margin: 0; color: #991B1B; font-weight: 500;">Commentaire :</p>
        <p style="margin: 4px 0 0; color: #7F1D1D;">${escapeHtml(notes)}</p>
      </div>`
    : "";

  return emailWrapper(`
    <h2 style="color: #1B3A5C; margin-top: 0;">Bonjour ${escapeHtml(firstName)},</h2>
    <p>Nous vous remercions pour votre interet pour Meridio et votre demande d'inscription pour <strong>${escapeHtml(companyName)}</strong>.</p>
    <p>Apres examen de votre demande, nous ne sommes malheureusement pas en mesure de l'accepter pour le moment.</p>
    ${notesHtml}
    <p>Si vous pensez qu'il s'agit d'une erreur ou si vous souhaitez obtenir plus d'informations, n'hesitez pas a nous contacter :</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${contactUrl}" style="display: inline-block; background-color: #1B3A5C; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Nous contacter</a>
    </div>
    <p style="color: #6b7280; font-size: 13px;">L'equipe Meridio reste a votre disposition.</p>
  `);
}
