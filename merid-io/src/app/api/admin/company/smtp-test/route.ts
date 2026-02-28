import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptOrFallback } from "@/lib/crypto";
import nodemailer from "nodemailer";

export async function POST() {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

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

    if (!company?.smtpHost || !company?.smtpUser) {
      return NextResponse.json(
        { error: "Configuration SMTP incomplète. Renseignez au minimum Host et User." },
        { status: 400 }
      );
    }

    let smtpPass = "";
    if (company.smtpPassEncrypted) {
      smtpPass = decryptOrFallback(company.smtpPassEncrypted, "SMTP password");
    }

    const port = company.smtpPort || 587;
    const transporter = nodemailer.createTransport({
      host: company.smtpHost,
      port,
      secure: company.smtpSecure || port === 465,
      auth: {
        user: company.smtpUser,
        pass: smtpPass,
      },
      ...(port !== 465 && {
        tls: { rejectUnauthorized: process.env.NODE_ENV === "production" },
      }),
      connectionTimeout: 10000,
    });

    await transporter.verify();

    return NextResponse.json({ success: true, message: "Connexion SMTP réussie" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json(
      { error: `Échec de la connexion SMTP: ${msg}` },
      { status: 400 }
    );
  }
}
