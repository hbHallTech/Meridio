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

    // Validation
    if (!data.name?.trim() || !data.email?.trim() || !data.message?.trim()) {
      return NextResponse.json(
        { error: "Nom, email et message sont obligatoires." },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return NextResponse.json(
        { error: "Adresse email invalide." },
        { status: 400 }
      );
    }

    const rows = [
      ["Nom", data.name],
      ["Email", data.email],
      ["Entreprise", data.company],
      ["Message", data.message],
    ];

    const htmlRows = rows
      .filter(([, val]) => val)
      .map(
        ([label, val]) =>
          `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#1B3A5C;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#334155">${escapeHtml(String(val))}</td></tr>`
      )
      .join("");

    const htmlBody = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:linear-gradient(135deg,#001F3F,#002855);color:white;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="margin:0;font-size:18px">Nouveau message de contact Meridio</h2>
          <p style="margin:4px 0 0;opacity:0.8;font-size:14px">${escapeHtml(data.name)} — ${escapeHtml(data.company || "N/A")}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0">
          ${htmlRows}
        </table>
        <div style="padding:16px 24px;background:#f8fafc;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:0">
          <p style="margin:0;font-size:13px;color:#64748b">
            Répondez à ce message via l'adresse email fournie ci-dessus.
          </p>
        </div>
      </div>
    `;

    const textBody = rows
      .filter(([, val]) => val)
      .map(([label, val]) => `${label}: ${val}`)
      .join("\n");

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
        subject: `[Meridio] Contact — ${data.name}`,
        text: textBody,
        html: htmlBody,
      });
    } else {
      console.log("=== CONTACT MESSAGE (no SMTP configured) ===");
      console.log(textBody);
      console.log("=============================================");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact request error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi du message." },
      { status: 500 }
    );
  }
}
