/**
 * Document Email Import Pipeline
 *
 * Connects to an IMAP mailbox, fetches unread emails with PDF attachments,
 * extracts metadata via text parsing + OCR fallback, and creates documents
 * in the system.
 *
 * Required env vars:
 *   DOCS_IMAP_HOST, DOCS_IMAP_PORT, DOCS_IMAP_USER, DOCS_IMAP_PASS
 *   DOCS_IMPORT_CRON_SECRET (for securing the cron endpoint)
 */

import { ImapFlow } from "imapflow";
import { PDFParse } from "pdf-parse";
import Tesseract from "tesseract.js";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { logAudit } from "@/lib/audit";
import crypto from "crypto";

// ─── Types ───

export interface ImportResult {
  processed: number;
  created: number;
  errors: string[];
  details: {
    messageId: string;
    from: string;
    subject: string;
    attachments: number;
    documentsCreated: number;
    error?: string;
  }[];
}

interface ParsedMetadata {
  employeeName: string | null;
  employeeEmail: string | null;
  month: string | null; // "01"-"12"
  year: string | null;  // "YYYY"
  documentType: "FICHE_PAIE" | "ATTESTATION_TRAVAIL" | "CERTIFICAT_TRAVAIL" | "CONTRAT" | "AUTRE";
}

// ─── Month mapping (French + English) ───

const MONTH_MAP: Record<string, string> = {
  // French abbreviated
  "janv": "01", "jan": "01", "janvier": "01",
  "fev": "02", "févr": "02", "fevr": "02", "février": "02", "fevrier": "02",
  "mars": "03", "mar": "03",
  "avr": "04", "avril": "04",
  "mai": "05",
  "juin": "06", "jun": "06",
  "juil": "07", "jul": "07", "juillet": "07",
  "aout": "08", "août": "08", "aou": "08",
  "sept": "09", "sep": "09", "septembre": "09",
  "oct": "10", "octobre": "10",
  "nov": "11", "novembre": "11",
  "dec": "12", "déc": "12", "décembre": "12", "decembre": "12",
  // English
  "january": "01", "february": "02", "march": "03", "april": "04",
  "may": "05", "june": "06", "july": "07", "august": "08",
  "september": "09", "october": "10", "november": "11", "december": "12",
};

// ─── Text-based metadata extraction ───

export function parsePayslipText(text: string): ParsedMetadata {
  const result: ParsedMetadata = {
    employeeName: null,
    employeeEmail: null,
    month: null,
    year: null,
    documentType: "FICHE_PAIE",
  };

  // Normalize text
  const normalized = text.replace(/\r\n/g, "\n").replace(/\s+/g, " ");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // ── Detect document type from keywords ──
  const lower = normalized.toLowerCase();
  if (lower.includes("bulletin de paie") || lower.includes("fiche de paie") || lower.includes("bulletin de salaire")) {
    result.documentType = "FICHE_PAIE";
  } else if (lower.includes("attestation de travail") || lower.includes("attestation d'emploi")) {
    result.documentType = "ATTESTATION_TRAVAIL";
  } else if (lower.includes("certificat de travail")) {
    result.documentType = "CERTIFICAT_TRAVAIL";
  } else if (lower.includes("contrat de travail") || lower.includes("contrat d'embauche")) {
    result.documentType = "CONTRAT";
  }

  // ── Extract period (month/year) ──
  // Pattern: "janv-26", "janvier 2026", "01/2026", "Période : 01/01/2026 - 31/01/2026"

  // Try "month-YY" or "month-YYYY" (e.g., "janv-26", "janvier-2026")
  const monthYearDash = /\b([a-zéèêàùûôâ]+)[.\-/](\d{2,4})\b/gi;
  let match;
  while ((match = monthYearDash.exec(normalized)) !== null) {
    const monthStr = match[1].toLowerCase();
    const yearStr = match[2];
    const monthNum = MONTH_MAP[monthStr];
    if (monthNum) {
      result.month = monthNum;
      result.year = yearStr.length === 2 ? `20${yearStr}` : yearStr;
      break;
    }
  }

  // Try "MM/YYYY" pattern
  if (!result.month) {
    const mmYYYY = /\b(\d{2})[/\-.](\d{4})\b/g;
    while ((match = mmYYYY.exec(normalized)) !== null) {
      const m = parseInt(match[1], 10);
      if (m >= 1 && m <= 12) {
        result.month = match[1];
        result.year = match[2];
        break;
      }
    }
  }

  // Try "Période du DD/MM/YYYY" pattern
  if (!result.month) {
    const periodPattern = /p[ée]riode[^0-9]*(\d{2})[/\-.](\d{2})[/\-.](\d{4})/i;
    const periodMatch = periodPattern.exec(normalized);
    if (periodMatch) {
      result.month = periodMatch[2];
      result.year = periodMatch[3];
    }
  }

  // ── Extract employee name ──
  // Look for patterns like "Employé: Nom Prénom", "Salarié : NOM Prénom", "M./Mme NOM"
  // Match exactly "LASTNAME Firstname" or "LASTNAME First Second" after label
  // Uses line-based matching (not normalized) to avoid cross-line capture
  for (const line of lines) {
    const labelPattern = /(?:employ[ée]|salari[ée]|collaborateur|nom\s+(?:et\s+)?pr[ée]nom)\s*[:]\s*(.+)/i;
    const labelMatch = labelPattern.exec(line);
    if (labelMatch) {
      result.employeeName = labelMatch[1].trim();
      break;
    }
  }

  // M./Mme pattern on normalized text (only if label match didn't find a name)
  if (!result.employeeName) {
    const titlePattern = /\b(?:M\.|Mme|Mr|Mrs)\s+([A-ZÉÈÊÀÙÛÔÂ][a-zéèêàùûôâ]+(?:\s+[A-ZÉÈÊÀÙÛÔÂ][a-zéèêàùûôâ]+)+)/;
    const titleMatch = titlePattern.exec(normalized);
    if (titleMatch) {
      result.employeeName = titleMatch[1].trim();
    }
  }

  // Fallback: look for a line with all-caps text that could be a name (common in payslips)
  if (!result.employeeName) {
    for (const line of lines) {
      // Match "LASTNAME Firstname" pattern (all-caps last name + capitalized first)
      const allCapsName = /^([A-ZÉÈÊÀÙÛÔÂ]{2,})\s+([A-ZÉÈÊÀÙÛÔÂ][a-zéèêàùûôâ]+)$/;
      const capsMatch = allCapsName.exec(line);
      if (capsMatch) {
        result.employeeName = `${capsMatch[1]} ${capsMatch[2]}`;
        break;
      }
    }
  }

  // ── Extract email ──
  const emailMatch = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/.exec(normalized);
  if (emailMatch) {
    result.employeeEmail = emailMatch[1].toLowerCase();
  }

  return result;
}

// ─── OCR Fallback for image-based PDFs ───

async function ocrFromBuffer(pdfBuffer: Buffer): Promise<string> {
  // tesseract.js can process image buffers directly
  // For PDF, we attempt to OCR the raw buffer (works for single-page image PDFs)
  const { data } = await Tesseract.recognize(pdfBuffer, "fra+eng", {
    logger: () => {}, // Suppress progress logs
  });
  return data.text;
}

// ─── Extract text from PDF (text-based first, OCR fallback) ───

export async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; usedOcr: boolean }> {
  try {
    // Try text extraction first (fast, accurate for digital PDFs)
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    const text = result.text?.trim();
    await parser.destroy().catch(() => {});
    if (text && text.length > 50) {
      return { text, usedOcr: false };
    }
  } catch {
    // pdf-parse failed, fall through to OCR
  }

  // OCR fallback for image-based / scanned PDFs
  try {
    const text = await ocrFromBuffer(buffer);
    return { text: text.trim(), usedOcr: true };
  } catch {
    return { text: "", usedOcr: true };
  }
}

// ─── Match employee by name or email ───

async function findEmployee(
  metadata: ParsedMetadata
): Promise<{ id: string; email: string } | null> {
  // Try email match first (most reliable)
  if (metadata.employeeEmail) {
    const user = await prisma.user.findUnique({
      where: { email: metadata.employeeEmail },
      select: { id: true, email: true, isActive: true },
    });
    if (user?.isActive) return { id: user.id, email: user.email };
  }

  // Try name match (fuzzy)
  if (metadata.employeeName) {
    const parts = metadata.employeeName.split(/\s+/);
    if (parts.length >= 2) {
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: [
            {
              firstName: { contains: parts[parts.length - 1], mode: "insensitive" },
              lastName: { contains: parts[0], mode: "insensitive" },
            },
            {
              firstName: { contains: parts[0], mode: "insensitive" },
              lastName: { contains: parts[parts.length - 1], mode: "insensitive" },
            },
          ],
        },
        select: { id: true, email: true },
      });
      if (users.length === 1) {
        return { id: users[0].id, email: users[0].email };
      }
    }
  }

  return null;
}

// ─── IMAP connection + email processing ───

export async function processIncomingEmails(): Promise<ImportResult> {
  const host = process.env.DOCS_IMAP_HOST;
  const port = parseInt(process.env.DOCS_IMAP_PORT || "993", 10);
  const user = process.env.DOCS_IMAP_USER;
  const pass = process.env.DOCS_IMAP_PASS;

  if (!host || !user || !pass) {
    return {
      processed: 0,
      created: 0,
      errors: ["IMAP credentials not configured (DOCS_IMAP_HOST, DOCS_IMAP_USER, DOCS_IMAP_PASS)"],
      details: [],
    };
  }

  const result: ImportResult = { processed: 0, created: 0, errors: [], details: [] };

  const company = await prisma.company.findFirst({
    select: { id: true, documentsModuleEnabled: true },
  });
  if (!company?.documentsModuleEnabled) {
    result.errors.push("Documents module is disabled");
    return result;
  }

  const client = new ImapFlow({
    host,
    port,
    secure: port === 993,
    auth: { user, pass },
    logger: false,
  });

  try {
    await client.connect();

    const lock = await client.getMailboxLock("INBOX");

    try {
      // Fetch unseen messages
      const messages = client.fetch({ seen: false }, {
        envelope: true,
        source: true,
        bodyStructure: true,
      });

      for await (const msg of messages) {
        const detail: ImportResult["details"][0] = {
          messageId: msg.envelope?.messageId ?? "unknown",
          from: msg.envelope?.from?.[0]?.address ?? "unknown",
          subject: msg.envelope?.subject ?? "(no subject)",
          attachments: 0,
          documentsCreated: 0,
        };

        try {
          // Download full message to extract attachments
          const downloadMsg = await client.download(msg.seq.toString(), undefined, { uid: false });
          if (!downloadMsg) {
            detail.error = "Could not download message";
            result.details.push(detail);
            result.processed++;
            continue;
          }

          // Parse raw email content for PDF attachments
          const rawContent = await streamToBuffer(downloadMsg.content);
          const attachments = extractPdfAttachments(rawContent);
          detail.attachments = attachments.length;

          if (attachments.length === 0) {
            // No PDF attachments, skip
            result.details.push(detail);
            result.processed++;
            continue;
          }

          for (const att of attachments) {
            try {
              // Extract text from PDF
              const { text, usedOcr } = await extractTextFromPdf(att.content);

              if (!text || text.length < 20) {
                // OCR failed or empty PDF
                await logAudit(null, "EMAIL_IMPORT_OCR_FAILURE", {
                  entityType: "Document",
                  newValue: {
                    filename: att.filename,
                    from: detail.from,
                    subject: detail.subject,
                    usedOcr,
                  },
                });
                detail.error = `OCR extraction failed for ${att.filename}`;
                await notifyHrImportFailure(att.filename, detail.from, detail.subject, "OCR extraction produced no usable text");
                continue;
              }

              // Parse metadata from extracted text
              const metadata = parsePayslipText(text);

              // Find matching employee
              const employee = await findEmployee(metadata);
              if (!employee) {
                detail.error = `No matching employee for ${att.filename} (name: ${metadata.employeeName}, email: ${metadata.employeeEmail})`;
                await notifyHrImportFailure(
                  att.filename,
                  detail.from,
                  detail.subject,
                  `Could not match employee: ${metadata.employeeName || "unknown"}`
                );
                continue;
              }

              // Upload PDF to Vercel Blob
              const ext = ".pdf";
              const blobPath = `documents/${employee.id}/${crypto.randomUUID()}${ext}`;
              const blob = await put(blobPath, att.content, {
                access: "private",
                addRandomSuffix: false,
              });

              // Generate document name
              const monthLabel = metadata.month
                ? `_${metadata.month}`
                : "";
              const yearLabel = metadata.year ?? new Date().getFullYear().toString();
              const typeLabel = metadata.documentType === "FICHE_PAIE"
                ? "Fiche_Paie"
                : metadata.documentType.replace(/_/g, "_");
              const docName = `${typeLabel}${monthLabel}-${yearLabel}.pdf`;

              // Create document record
              const document = await prisma.document.create({
                data: {
                  userId: employee.id,
                  name: att.filename || docName,
                  type: metadata.documentType,
                  filePath: blob.url,
                  fileSize: att.content.length,
                  mimeType: "application/pdf",
                  metadata: {
                    ...(metadata.month ? { mois: metadata.month } : {}),
                    ...(metadata.year ? { annee: metadata.year } : {}),
                    source: "email_import",
                    usedOcr,
                    senderEmail: detail.from,
                  },
                },
              });

              await logAudit(null, "EMAIL_IMPORT_SUCCESS", {
                entityType: "Document",
                entityId: document.id,
                newValue: {
                  name: document.name,
                  type: document.type,
                  userId: employee.id,
                  source: "email",
                  from: detail.from,
                  usedOcr,
                  employeeName: metadata.employeeName,
                },
              });

              detail.documentsCreated++;
              result.created++;
            } catch (attErr) {
              const errMsg = attErr instanceof Error ? attErr.message : String(attErr);
              detail.error = `Error processing ${att.filename}: ${errMsg}`;
              result.errors.push(detail.error);
            }
          }

          // Mark message as seen
          await client.messageFlagsAdd(msg.seq.toString(), ["\\Seen"], { uid: false });
        } catch (msgErr) {
          const errMsg = msgErr instanceof Error ? msgErr.message : String(msgErr);
          detail.error = errMsg;
          result.errors.push(`Message ${detail.messageId}: ${errMsg}`);
        }

        result.details.push(detail);
        result.processed++;
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (connErr) {
    const errMsg = connErr instanceof Error ? connErr.message : String(connErr);
    result.errors.push(`IMAP connection error: ${errMsg}`);
  }

  return result;
}

// ─── Helpers ───

async function streamToBuffer(stream: ReadableStream | NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Uint8Array[] = [];

  if ("getReader" in stream) {
    // Web ReadableStream
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } else {
    // Node.js Readable
    for await (const chunk of stream) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
  }

  return Buffer.concat(chunks);
}

/**
 * Simple PDF attachment extractor from raw email bytes.
 * Parses MIME multipart to find application/pdf parts.
 */
function extractPdfAttachments(raw: Buffer): { filename: string; content: Buffer }[] {
  const attachments: { filename: string; content: Buffer }[] = [];
  const text = raw.toString("utf-8");

  // Find boundary from Content-Type header
  const boundaryMatch = /boundary="?([^"\r\n;]+)"?/i.exec(text);
  if (!boundaryMatch) return attachments;

  const boundary = boundaryMatch[1];
  const parts = text.split(`--${boundary}`);

  for (const part of parts) {
    // Check if this part is a PDF attachment
    if (!/application\/pdf/i.test(part) && !/\.pdf/i.test(part)) continue;

    // Extract filename
    const fnMatch = /filename="?([^"\r\n]+)"?/i.exec(part);
    const filename = fnMatch ? fnMatch[1].trim() : "document.pdf";

    // Extract base64 content (after double CRLF)
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const bodyRaw = part.slice(headerEnd + 4);

    // Check transfer encoding
    const isBase64 = /content-transfer-encoding:\s*base64/i.test(part);

    if (isBase64) {
      // Remove trailing boundary markers and whitespace
      const cleaned = bodyRaw.replace(/--[^\r\n]*$/, "").replace(/\s/g, "");
      if (cleaned.length > 0) {
        try {
          const buffer = Buffer.from(cleaned, "base64");
          // Verify it starts with PDF magic bytes
          if (buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50) {
            attachments.push({ filename, content: buffer });
          }
        } catch {
          // Invalid base64, skip
        }
      }
    }
  }

  return attachments;
}

/**
 * Notify HR users when an import fails.
 * Creates an in-app notification + sends to configured notify email.
 */
async function notifyHrImportFailure(
  filename: string,
  senderEmail: string,
  subject: string,
  reason: string
): Promise<void> {
  try {
    // Find HR users to notify
    const hrUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        roles: { hasSome: ["HR", "ADMIN"] },
      },
      select: { id: true },
    });

    // Create in-app notifications
    for (const hr of hrUsers) {
      await prisma.notification.create({
        data: {
          userId: hr.id,
          type: "DOCUMENT_IMPORT_FAILURE",
          title_fr: `Échec d'import document`,
          title_en: `Document import failure`,
          body_fr: `Le fichier "${filename}" de ${senderEmail} (${subject}) n'a pas pu être importé : ${reason}`,
          body_en: `File "${filename}" from ${senderEmail} (${subject}) could not be imported: ${reason}`,
          data: { filename, senderEmail, subject, reason },
        },
      });
    }
  } catch {
    // Non-critical, log and continue
    console.error("[email-import] Failed to notify HR about import failure");
  }
}
