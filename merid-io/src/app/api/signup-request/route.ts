import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

/** Escape HTML special characters to prevent injection in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Basic validation
    if (!data.email || !data.firstName || !data.companyName) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants." },
        { status: 400 }
      );
    }

    // Build a structured email body
    const rows = [
      ["Email", data.email],
      ["Téléphone", data.phone],
      ["Prénom", data.firstName],
      ["Nom", data.lastName],
      ["Fonction", data.jobTitle],
      ["Entreprise", data.companyName],
      ["Domaine d'activité", data.activityDomain],
      ["Site Internet", data.website],
      ["Nombre d'employés", data.employeeCount],
      ["Nom organisation", data.orgName],
      ["Adresse", data.street],
      ["Code postal", data.postalCode],
      ["Ville", data.city],
      ["Pays", data.country],
      ["Téléphone entreprise", data.orgPhone],
      ["Besoins IA", data.aiNeeds],
      ["Nombre d'entités/filiales", data.subsidiaryCount],
    ];

    const htmlRows = rows
      .filter(([, val]) => val)
      .map(
        ([label, val]) =>
          `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#1B3A5C;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#334155">${escapeHtml(val)}</td></tr>`
      )
      .join("");

    const htmlBody = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1B3A5C;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="margin:0;font-size:18px">Nouvelle demande d'inscription Meridio</h2>
          <p style="margin:4px 0 0;opacity:0.8;font-size:14px">${escapeHtml(data.companyName)} — ${escapeHtml(data.firstName)} ${escapeHtml(data.lastName || "")}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0">
          ${htmlRows}
        </table>
        <div style="padding:16px 24px;background:#f8fafc;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:0">
          <p style="margin:0;font-size:13px;color:#64748b">
            Cette demande nécessite l'approbation d'un super administrateur pour créer le tenant.
          </p>
        </div>
      </div>
    `;

    const textBody = rows
      .filter(([, val]) => val)
      .map(([label, val]) => `${label}: ${val}`)
      .join("\n");

    // Create transporter — use SMTP env vars if available, else try EmailJS fallback
    const smtpHost = process.env.SIGNUP_SMTP_HOST || process.env.SMTP_HOST;
    const smtpUser = process.env.SIGNUP_SMTP_USER || process.env.SMTP_USER;
    const smtpPass = process.env.SIGNUP_SMTP_PASS || process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SIGNUP_SMTP_PORT || process.env.SMTP_PORT || 587),
        secure: (process.env.SIGNUP_SMTP_SECURE || process.env.SMTP_SECURE) === "true",
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 10_000,
        greetingTimeout: 8_000,
        socketTimeout: 15_000,
      });

      await transporter.sendMail({
        from: smtpUser,
        to: "Xelor.meridio@gmail.com",
        subject: `[Meridio] Nouvelle inscription — ${data.companyName}`,
        text: textBody,
        html: htmlBody,
      });
    } else {
      // Fallback: log the request for manual processing
      console.log("=== SIGNUP REQUEST (no SMTP configured) ===");
      console.log(textBody);
      console.log("============================================");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Signup request error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi de la demande." },
      { status: 500 }
    );
  }
}
