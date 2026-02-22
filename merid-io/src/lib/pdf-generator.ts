/**
 * PDF Generator for attestations and certificates.
 *
 * Uses pdf-lib to programmatically create PDF documents
 * from templates with variable substitution.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// ─── Types ───

export interface AttestationData {
  // Employee
  employeeFirstName: string;
  employeeLastName: string;
  employeeEmail: string;
  hireDate: Date;
  officeName: string;
  officeCity: string;
  officeCountry: string;

  // Company
  companyName: string;
  companyAddress: string | null;
  companyPostalCode: string | null;
  companyCity: string | null;
  companyCountry: string;
  companyLegalForm: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  companyLogoUrl: string | null;

  // Document
  documentType: "ATTESTATION_TRAVAIL" | "CERTIFICAT_TRAVAIL";
  templateContent: string | null;
  generatedDate: Date;
}

// ─── Helpers ───

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function companyFullAddress(data: AttestationData): string {
  const parts = [
    data.companyAddress,
    data.companyPostalCode && data.companyCity
      ? `${data.companyPostalCode} ${data.companyCity}`
      : data.companyCity,
  ].filter(Boolean);
  return parts.join(", ");
}

// ─── Variable substitution ───

function substituteVariables(content: string, data: AttestationData): string {
  const vars: Record<string, string> = {
    employee_name: `${data.employeeFirstName} ${data.employeeLastName}`,
    employee_first_name: data.employeeFirstName,
    employee_last_name: data.employeeLastName,
    employee_email: data.employeeEmail,
    company_name: data.companyName,
    company_address: companyFullAddress(data),
    company_legal_form: data.companyLegalForm ?? "",
    hire_date: formatDateFr(data.hireDate),
    date: formatDateFr(data.generatedDate),
    year: data.generatedDate.getFullYear().toString(),
    month: data.generatedDate.toLocaleDateString("fr-FR", { month: "long" }),
    office_name: data.officeName,
    office_city: data.officeCity,
    contact_name: [data.contactFirstName, data.contactLastName].filter(Boolean).join(" ") || data.companyName,
    document_type:
      data.documentType === "ATTESTATION_TRAVAIL"
        ? "Attestation de travail"
        : "Certificat de travail",
  };

  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

// ─── Default templates ───

function getDefaultTemplate(type: "ATTESTATION_TRAVAIL" | "CERTIFICAT_TRAVAIL"): string {
  if (type === "ATTESTATION_TRAVAIL") {
    return [
      "ATTESTATION DE TRAVAIL",
      "",
      "Je soussigné(e), {{contact_name}}, agissant en qualité de représentant(e) de la société {{company_name}}{{company_legal_form}}, dont le siège social est situé {{company_address}},",
      "",
      "Atteste par la présente que :",
      "",
      "M./Mme {{employee_name}}",
      "",
      "est employé(e) au sein de notre entreprise depuis le {{hire_date}}.",
      "",
      "Cette attestation est délivrée pour servir et valoir ce que de droit.",
      "",
      "Fait à {{office_city}}, le {{date}}.",
      "",
      "",
      "{{contact_name}}",
      "{{company_name}}",
    ].join("\n");
  }

  // CERTIFICAT_TRAVAIL
  return [
    "CERTIFICAT DE TRAVAIL",
    "",
    "Je soussigné(e), {{contact_name}}, agissant en qualité de représentant(e) de la société {{company_name}}{{company_legal_form}}, dont le siège social est situé {{company_address}},",
    "",
    "Certifie par la présente que :",
    "",
    "M./Mme {{employee_name}}",
    "",
    "a été employé(e) dans notre entreprise du {{hire_date}} au {{date}}.",
    "",
    "Durant cette période, M./Mme {{employee_name}} a fait preuve de compétence et de professionnalisme dans l'exercice de ses fonctions.",
    "",
    "Le présent certificat est établi conformément aux dispositions légales en vigueur.",
    "",
    "Fait à {{office_city}}, le {{date}}.",
    "",
    "",
    "{{contact_name}}",
    "{{company_name}}",
  ].join("\n");
}

// ─── PDF Generation ───

export async function generateAttestationPdf(data: AttestationData): Promise<Uint8Array> {
  const templateContent = data.templateContent || getDefaultTemplate(data.documentType);
  const filledContent = substituteVariables(templateContent, data);

  // Strip HTML tags if template content contains HTML
  const plainText = filledContent.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 60;
  const contentWidth = pageWidth - margin * 2;
  const lineHeight = 16;
  const titleSize = 18;
  const bodySize = 11;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // ─── Company logo ───
  const logoMaxHeight = 50;
  const logoMaxWidth = 140;
  let logoWidth = 0;

  if (data.companyLogoUrl) {
    try {
      let logoBytes: Uint8Array;
      let contentType = "";

      if (data.companyLogoUrl.startsWith("data:")) {
        // Data URI — extract bytes directly (no network request needed)
        const match = data.companyLogoUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) throw new Error("Invalid data URI");
        contentType = match[1];
        logoBytes = Uint8Array.from(Buffer.from(match[2], "base64"));
      } else {
        // External URL — SSRF protection: only allow HTTPS with public hostnames
        const logoUrlObj = new URL(data.companyLogoUrl);
        const blockedPatterns = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|::1|\[::)/;
        if (logoUrlObj.protocol !== "https:" || blockedPatterns.test(logoUrlObj.hostname)) {
          throw new Error("Invalid logo URL");
        }
        const logoRes = await fetch(data.companyLogoUrl, { signal: AbortSignal.timeout(5000) });
        if (!logoRes.ok) throw new Error(`Logo fetch failed: ${logoRes.status}`);
        logoBytes = new Uint8Array(await logoRes.arrayBuffer());
        contentType = logoRes.headers.get("content-type") || "";
      }

      let logoImage;
      if (contentType.includes("png") || data.companyLogoUrl.endsWith(".png")) {
        logoImage = await pdfDoc.embedPng(logoBytes);
      } else if (contentType.includes("svg")) {
        // SVG not supported by pdf-lib — skip
        throw new Error("SVG not supported");
      } else {
        // Default to JPEG for jpg/jpeg/webp/other
        logoImage = await pdfDoc.embedJpg(logoBytes);
      }

      // Scale logo to fit within max bounds while preserving aspect ratio
      const scale = Math.min(
        logoMaxWidth / logoImage.width,
        logoMaxHeight / logoImage.height,
        1 // never upscale
      );
      const drawWidth = logoImage.width * scale;
      const drawHeight = logoImage.height * scale;

      page.drawImage(logoImage, {
        x: margin,
        y: y - drawHeight + 10,
        width: drawWidth,
        height: drawHeight,
      });

      logoWidth = drawWidth + 15; // gap between logo and text
    } catch {
      // Logo embedding failed — continue without logo
    }
  }

  // ─── Company header (text next to logo) ───
  const companyNameStr = data.companyName;
  const companyAddr = companyFullAddress(data);
  const textX = margin + logoWidth;

  page.drawText(companyNameStr, {
    x: textX,
    y,
    size: 13,
    font: helveticaBold,
    color: rgb(0.106, 0.227, 0.361), // #1B3A5C
  });
  y -= 18;

  if (companyAddr) {
    page.drawText(companyAddr, {
      x: textX,
      y,
      size: 9,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 14;
  }

  if (data.companyLegalForm) {
    page.drawText(data.companyLegalForm, {
      x: textX,
      y,
      size: 9,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 14;
  }

  // Separator line
  y -= 10;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: rgb(0, 0.737, 0.831), // #00BCD4
  });
  y -= 30;

  // ─── Render filled content ───
  const lines = plainText.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if we need a new page
    if (y < margin + 40) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    if (!trimmed) {
      y -= lineHeight * 0.8;
      continue;
    }

    // Title detection (all caps or first line)
    const isTitle =
      trimmed === trimmed.toUpperCase() && trimmed.length > 5 && !trimmed.includes(",");

    if (isTitle) {
      const titleWidth = helveticaBold.widthOfTextAtSize(trimmed, titleSize);
      page.drawText(trimmed, {
        x: (pageWidth - titleWidth) / 2, // centered
        y,
        size: titleSize,
        font: helveticaBold,
        color: rgb(0.106, 0.227, 0.361),
      });
      y -= titleSize + 12;
      continue;
    }

    // Word-wrap for body text
    const words = trimmed.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = helvetica.widthOfTextAtSize(testLine, bodySize);

      if (testWidth > contentWidth && currentLine) {
        page.drawText(currentLine, {
          x: margin,
          y,
          size: bodySize,
          font: helvetica,
          color: rgb(0.15, 0.15, 0.15),
        });
        y -= lineHeight;
        currentLine = word;

        if (y < margin + 40) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      page.drawText(currentLine, {
        x: margin,
        y,
        size: bodySize,
        font: helvetica,
        color: rgb(0.15, 0.15, 0.15),
      });
      y -= lineHeight;
    }
  }

  // ─── Footer with date ───
  const firstPage = pdfDoc.getPage(0);
  firstPage.drawText(
    `Document généré le ${formatDateFr(data.generatedDate)}`,
    {
      x: margin,
      y: 30,
      size: 8,
      font: helvetica,
      color: rgb(0.6, 0.6, 0.6),
    }
  );

  return pdfDoc.save();
}
