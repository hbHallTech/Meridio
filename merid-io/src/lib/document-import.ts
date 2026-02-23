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

import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { logAudit } from "@/lib/audit";
import { decrypt } from "@/lib/crypto";
import crypto from "crypto";
import { inflateSync } from "zlib";

// Prevent stale IMAP socket errors from crashing the Vercel serverless process.
// In Vercel, function containers are reused — a previous invocation's IMAP connection
// may still exist and emit errors (ECONNRESET, Socket timeout) after our handler exits.
if (typeof process !== "undefined" && !process.env.__IMAP_UNCAUGHT_HANDLER) {
  process.env.__IMAP_UNCAUGHT_HANDLER = "1";
  process.on("uncaughtException", (err) => {
    const msg = err?.message || "";
    if (msg.includes("ECONNRESET") || msg.includes("Socket timeout") || msg.includes("ETIMEOUT")) {
      console.warn(`[imap-import] Caught stale socket error (non-fatal): ${msg}`);
      return; // Swallow — these are from previous invocation's dead connections
    }
    // Re-throw non-IMAP errors so they're not silently swallowed
    throw err;
  });
}

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

// ─── Built-in lightweight PDF text extractor ───
// Parses PDF streams directly using Node.js zlib — no pdfjs-dist or DOM required.
// Supports ToUnicode CMap parsing for CID/Identity-H fonts (common in Word/Excel PDFs).

/** Parse a ToUnicode CMap stream and return a glyph-ID → Unicode mapping */
function parseToUnicodeCMap(cmapText: string): Map<number, string> {
  const map = new Map<number, string>();

  // Parse beginbfchar...endbfchar sections
  // Format: <srcCode> <dstString>
  const bfcharRegex = /beginbfchar([\s\S]*?)endbfchar/g;
  let section;
  while ((section = bfcharRegex.exec(cmapText)) !== null) {
    const pairRegex = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let pair;
    while ((pair = pairRegex.exec(section[1])) !== null) {
      const gid = parseInt(pair[1], 16);
      // Destination can be multi-byte (UTF-16BE)
      const dstHex = pair[2];
      let str = "";
      for (let i = 0; i < dstHex.length; i += 4) {
        const code = parseInt(dstHex.substring(i, Math.min(i + 4, dstHex.length)), 16);
        if (code > 0) str += String.fromCharCode(code);
      }
      if (str) map.set(gid, str);
    }
  }

  // Parse beginbfrange...endbfrange sections
  // Format: <srcCodeLo> <srcCodeHi> <dstStringLo>
  //    or:  <srcCodeLo> <srcCodeHi> [<dst1> <dst2> ...]
  const bfrangeRegex = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((section = bfrangeRegex.exec(cmapText)) !== null) {
    // Simple range: <lo> <hi> <dstStart>
    const rangeRegex = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let range;
    while ((range = rangeRegex.exec(section[1])) !== null) {
      const lo = parseInt(range[1], 16);
      const hi = parseInt(range[2], 16);
      let dstStart = parseInt(range[3], 16);
      for (let gid = lo; gid <= hi; gid++) {
        map.set(gid, String.fromCharCode(dstStart++));
      }
    }
  }

  return map;
}

export function extractTextFromPdfBuffer(buffer: Buffer): string {
  const textChunks: string[] = [];

  // Find all stream objects and extract text operators
  const pdfStr = buffer.toString("latin1");

  // First pass: decompress all streams and collect ToUnicode CMaps
  const globalCMap = new Map<number, string>();
  const decompressedStreams: { content: string; beforeStream: string }[] = [];

  const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
  let streamMatch;

  while ((streamMatch = streamRegex.exec(pdfStr)) !== null) {
    let content = streamMatch[1];
    const beforeStream = pdfStr.slice(Math.max(0, streamMatch.index - 500), streamMatch.index);
    const isCompressed = /\/Filter\s*\/FlateDecode/i.test(beforeStream);

    if (isCompressed) {
      try {
        const compressedBytes = Buffer.from(content, "latin1");
        const decompressed = inflateSync(compressedBytes);
        content = decompressed.toString("latin1");
      } catch {
        continue;
      }
    }

    // Check if this stream is a ToUnicode CMap
    if (content.includes("beginbfchar") || content.includes("beginbfrange")) {
      const cmap = parseToUnicodeCMap(content);
      for (const [k, v] of cmap) globalCMap.set(k, v);
    }

    decompressedStreams.push({ content, beforeStream });
  }

  if (globalCMap.size > 0) {
    console.log(`[imap-import] Parsed ToUnicode CMap: ${globalCMap.size} glyph mappings`);
  }

  // Second pass: extract text operators using CMap if available
  for (const { content } of decompressedStreams) {
    extractTextOperators(content, textChunks, globalCMap);
  }

  // Join chunks with appropriate spacing
  let result = "";
  for (const chunk of textChunks) {
    if (!chunk) continue;
    // Add space between chunks unless it's a newline
    if (result && !result.endsWith("\n") && !chunk.startsWith("\n")) {
      result += " ";
    }
    result += chunk;
  }

  return result.trim();
}

/** Decode PDF string escape sequences */
function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{1,3})/g, (_m, oct) => String.fromCharCode(parseInt(oct, 8)));
}

/** Decode hex string to text, using ToUnicode CMap if available */
function decodeHexString(hex: string, cmap?: Map<number, string>): string {
  try {
    // If we have a ToUnicode CMap, use it to decode glyph IDs → Unicode
    if (cmap && cmap.size > 0 && hex.length >= 4 && hex.length % 4 === 0) {
      let text = "";
      for (let i = 0; i < hex.length; i += 4) {
        const gid = parseInt(hex.substring(i, i + 4), 16);
        if (gid === 0) continue;
        const mapped = cmap.get(gid);
        if (mapped) {
          text += mapped;
        } else {
          text += String.fromCharCode(gid); // Fallback: treat as Unicode code point
        }
      }
      if (text && /[A-Za-z0-9\u00C0-\u024F]/.test(text)) {
        return text;
      }
    }

    // Many PDFs (especially from Word/Excel) use CID/Identity-H fonts where
    // hex strings encode UTF-16BE: each character = 4 hex digits (2 bytes).
    // e.g., <00530069007200690065> = "Sirie"
    if (hex.length >= 4 && hex.length % 4 === 0) {
      let text = "";
      for (let i = 0; i < hex.length; i += 4) {
        const code = parseInt(hex.substring(i, i + 4), 16);
        if (code === 0) continue; // Skip NULL characters
        text += String.fromCharCode(code);
      }
      // If result contains actual printable characters, use it
      if (/[A-Za-z0-9\u00C0-\u024F]/.test(text)) {
        return text;
      }
    }
    // Fallback: single-byte latin1 encoding (standard PDF text)
    return Buffer.from(hex, "hex").toString("latin1");
  } catch {
    return "";
  }
}

/** Extract text from PDF content stream operators */
function extractTextOperators(content: string, chunks: string[], cmap?: Map<number, string>) {
  // Tj with parenthesized string: (text) Tj
  const tjParenMatches = content.matchAll(/\(([^)]*)\)\s*Tj/g);
  for (const m of tjParenMatches) {
    chunks.push(decodePdfString(m[1]));
  }

  // Tj with hex string: <hex> Tj
  const tjHexMatches = content.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g);
  for (const m of tjHexMatches) {
    const text = decodeHexString(m[1], cmap);
    if (text && /\S/.test(text)) {
      chunks.push(text);
    }
  }

  // TJ array with mixed strings: [(text) -kern <hex> ...] TJ
  const tjArrayMatches = content.matchAll(/\[([^\]]*)\]\s*TJ/g);
  for (const m of tjArrayMatches) {
    const arrayContent = m[1];
    const combined: string[] = [];

    // Match both (paren) and <hex> strings
    const stringParts = arrayContent.matchAll(/\(([^)]*)\)|<([0-9A-Fa-f]+)>/g);
    for (const p of stringParts) {
      if (p[1] !== undefined) {
        combined.push(decodePdfString(p[1]));
      } else if (p[2] !== undefined) {
        combined.push(decodeHexString(p[2], cmap));
      }
    }
    if (combined.length > 0) {
      chunks.push(combined.join(""));
    }
  }

  // ' operator: (text) ' — move to next line and show text
  const quoteParenMatches = content.matchAll(/\(([^)]*)\)\s*'/g);
  for (const m of quoteParenMatches) {
    chunks.push("\n" + decodePdfString(m[1]));
  }

  // ' operator with hex: <hex> '
  const quoteHexMatches = content.matchAll(/<([0-9A-Fa-f]+)>\s*'/g);
  for (const m of quoteHexMatches) {
    const text = decodeHexString(m[1], cmap);
    if (text) chunks.push("\n" + text);
  }
}

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
// NOTE: tesseract.js worker module is NOT bundled by Vercel's serverless bundler,
// causing "Cannot find module 'tesseract.js/src/worker-script/node/index.js'" crashes.
// OCR is disabled in serverless — pdfjs-dist + built-in parser handle text-based PDFs.
// For scanned/image PDFs, the document is still created (unassigned) for HR to handle.

// ─── Extract text from PDF (built-in first, OCR fallback) ───

/** Check if extracted text has enough meaningful content (letters/digits vs total) */
function isTextMeaningful(text: string, minAlphaRatio = 0.15, minAlphaChars = 30): boolean {
  if (!text) return false;
  const alphaCount = (text.match(/[A-Za-z0-9\u00C0-\u024F]/g) || []).length;
  return alphaCount >= minAlphaChars && (alphaCount / text.length) >= minAlphaRatio;
}

export async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; usedOcr: boolean }> {
  // Strategy 1: pdfjs-dist (most robust, handles CID/Identity-H fonts natively)
  // Uses legacy build which works without Canvas/DOMMatrix in serverless.
  // Warnings about @napi-rs/canvas, DOMMatrix, Path2D are non-fatal — we only need text extraction.
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      verbosity: 0,
      // Disable features that need browser/canvas APIs (not available in serverless)
      disableFontFace: true,
      isEvalSupported: false,
    });
    const pdfDoc = await loadingTask.promise;

    let fullText = "";
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const tc = await page.getTextContent();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageText = tc.items.map((item: any) => item.str || "").join(" ");
      fullText += pageText + "\n";
    }
    fullText = fullText.trim();

    if (isTextMeaningful(fullText)) {
      console.log(`[imap-import] pdfjs-dist extraction: ${fullText.length} chars (meaningful)`);
      return { text: fullText, usedOcr: false };
    }
    console.log(`[imap-import] pdfjs-dist extraction: ${fullText.length} chars but not meaningful, trying built-in...`);
  } catch (e) {
    console.log(`[imap-import] pdfjs-dist extraction failed:`, e instanceof Error ? e.message : e);
  }

  // Strategy 2: Built-in text extraction with ToUnicode CMap support
  try {
    const text = extractTextFromPdfBuffer(buffer);
    if (isTextMeaningful(text)) {
      console.log(`[imap-import] Built-in extraction: ${text.length} chars (meaningful)`);
      return { text, usedOcr: false };
    }
    console.log(`[imap-import] Built-in extraction: ${text.length} chars but not meaningful`);
  } catch (e) {
    console.log(`[imap-import] Built-in extraction failed:`, e instanceof Error ? e.message : e);
  }

  // No OCR fallback in serverless (tesseract.js worker not bundled by Vercel)
  // Return empty — the document will still be created as unassigned for HR
  console.warn(`[imap-import] All text extraction strategies failed — document will be created without parsed metadata`);
  return { text: "", usedOcr: false };
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

// ─── MIME structure PDF part finder ───
// Traverses ImapFlow bodyStructure tree to find PDF attachment MIME parts

interface PdfPartInfo {
  part: string;    // MIME part number (e.g., "2", "1.2")
  filename: string;
  size: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findPdfParts(bodyStructure: any): PdfPartInfo[] {
  const parts: PdfPartInfo[] = [];
  if (!bodyStructure) return parts;

  function walk(node: Record<string, unknown>, prefix?: string) {
    const type = String(node.type || "").toLowerCase();
    const disposition = String(node.disposition || "").toLowerCase();
    const filename =
      (node.dispositionParameters as Record<string, string>)?.filename ||
      (node.parameters as Record<string, string>)?.name ||
      "";

    const partNum = prefix || String(node.part || "");

    // Check if this part is a PDF
    if (
      type === "application/pdf" ||
      (filename && /\.pdf$/i.test(filename))
    ) {
      parts.push({
        part: partNum,
        filename: filename || "document.pdf",
        size: Number(node.size) || 0,
      });
    }

    // Recurse into child nodes (multipart messages)
    const children = node.childNodes as Record<string, unknown>[] | undefined;
    if (Array.isArray(children)) {
      for (const child of children) {
        walk(child, child.part ? String(child.part) : undefined);
      }
    }
  }

  walk(bodyStructure);
  return parts;
}

// ─── Raw TCP/TLS connectivity test ───

async function testImapConnectivity(host: string, port: number, secure: boolean): Promise<void> {
  const net = await import("net");
  const tls = await import("tls");
  const dns = await import("dns");

  // Step A: DNS resolution
  const t0 = Date.now();
  const addresses = await new Promise<string[]>((resolve, reject) => {
    dns.resolve4(host, (err, addrs) => {
      if (err) reject(new Error(`DNS resolution failed for ${host}: ${err.code}`));
      else resolve(addrs);
    });
  });
  console.log(`[imap-import] DNS resolved ${host} → ${addresses.join(", ")} (${Date.now() - t0}ms)`);

  // Step B: Raw TCP/TLS connection test
  return new Promise<void>((resolve, reject) => {
    const timeout = 15_000; // 15s for raw connection test

    if (secure) {
      // Direct TLS (port 993)
      const socket = tls.connect(
        { host, port, rejectUnauthorized: false, timeout },
        () => {
          console.log(`[imap-import] TLS handshake OK — cipher: ${socket.getCipher()?.name}, protocol: ${socket.getProtocol()}`);
          socket.destroy();
          resolve();
        }
      );
      socket.on("error", (err) => {
        socket.destroy();
        reject(new Error(`TLS connection to ${host}:${port} failed: ${err.message}`));
      });
      socket.setTimeout(timeout, () => {
        socket.destroy();
        reject(new Error(`TLS connection to ${host}:${port} timed out after ${timeout / 1000}s`));
      });
    } else {
      // Plain TCP (port 143, then STARTTLS)
      const socket = net.connect({ host, port, timeout }, () => {
        console.log(`[imap-import] TCP connection OK to ${host}:${port}`);
        socket.destroy();
        resolve();
      });
      socket.on("error", (err) => {
        socket.destroy();
        reject(new Error(`TCP connection to ${host}:${port} failed: ${err.message}`));
      });
      socket.setTimeout(timeout, () => {
        socket.destroy();
        reject(new Error(`TCP connection to ${host}:${port} timed out after ${timeout / 1000}s`));
      });
    }
  });
}

// ─── IMAP constants ───

const DOWNLOAD_TIMEOUT = 30_000; // 30s max per attachment download

// ─── IMAP connection + email processing ───

export async function processIncomingEmails(): Promise<ImportResult> {
  const result: ImportResult = { processed: 0, created: 0, errors: [], details: [] };

  const company = await prisma.company.findFirst({
    select: {
      id: true,
      documentsModuleEnabled: true,
      docsImapHost: true,
      docsImapPort: true,
      docsImapUser: true,
      docsImapPassEncrypted: true,
      docsImapSecure: true,
    },
  });
  if (!company?.documentsModuleEnabled) {
    result.errors.push("Documents module is disabled");
    return result;
  }

  // Read IMAP config: database first, env variables as fallback
  const host = company.docsImapHost || process.env.DOCS_IMAP_HOST;
  const port = company.docsImapPort || parseInt(process.env.DOCS_IMAP_PORT || "993", 10);
  const user = company.docsImapUser || process.env.DOCS_IMAP_USER;
  const secure = company.docsImapHost ? company.docsImapSecure : (port === 993);

  let pass: string | undefined;
  if (company.docsImapPassEncrypted) {
    try {
      pass = decrypt(company.docsImapPassEncrypted);
      console.log(`[imap-import] Password decrypted OK (length: ${pass.length})`);
    } catch (decryptErr) {
      console.warn(`[imap-import] Decryption failed, using raw value:`, decryptErr);
      // If decryption fails (ENCRYPTION_KEY changed), try using as-is (dev mode)
      pass = company.docsImapPassEncrypted;
    }
  }
  if (!pass) {
    pass = process.env.DOCS_IMAP_PASS;
    if (pass) console.log(`[imap-import] Using DOCS_IMAP_PASS env var`);
  }

  if (!host || !user || !pass) {
    return {
      processed: 0,
      created: 0,
      errors: ["Configuration IMAP manquante — saisissez les paramètres dans Intégration ou configurez les variables d'environnement"],
      details: [],
    };
  }

  console.log(`[imap-import] Config: host=${host}, port=${port}, user=${user}, secure=${secure}`);

  // Connect via ImapFlow
  const { ImapFlow } = await import("imapflow");

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: {
      debug: (obj: Record<string, unknown>) => console.log(`[imap-debug]`, obj.msg || ""),
      info: (obj: Record<string, unknown>) => console.log(`[imap-info]`, obj.msg || ""),
      warn: (obj: Record<string, unknown>) => console.warn(`[imap-warn]`, obj.msg || ""),
      error: (obj: Record<string, unknown>) => console.error(`[imap-error]`, obj.msg || ""),
    },
    tls: {
      rejectUnauthorized: false, // Accept self-signed certs (some corporate IMAP servers)
    },
    connectionTimeout: 30_000,  // 30s TCP connect
    greetingTimeout: 30_000,    // 30s for server greeting
  });

  // Prevent uncaught ECONNRESET from crashing the Node.js process
  client.on("error", (err: Error) => {
    console.error(`[imap-import] ImapFlow error event: ${err.message}`);
  });

  try {
    console.log(`[imap-import] Connecting via ImapFlow...`);
    const t1 = Date.now();
    await client.connect();
    console.log(`[imap-import] ImapFlow connected OK (${Date.now() - t1}ms)`);

    const lock = await client.getMailboxLock("INBOX");

    try {
      // Phase 1: Fetch metadata only (fast) — identify messages with PDF attachments
      const msgMetas: { seq: number; uid: number; detail: ImportResult["details"][0]; hasPdf: boolean }[] = [];
      const messages = client.fetch({ seen: false }, {
        envelope: true,
        bodyStructure: true,
        uid: true,
      });

      for await (const msg of messages) {
        const detail: ImportResult["details"][0] = {
          messageId: msg.envelope?.messageId ?? "unknown",
          from: msg.envelope?.from?.[0]?.address ?? "unknown",
          subject: msg.envelope?.subject ?? "(no subject)",
          attachments: 0,
          documentsCreated: 0,
        };
        const pdfParts = findPdfParts(msg.bodyStructure);
        console.log(`[imap-import] Message ${msg.seq}: ${detail.subject} — ${pdfParts.length} PDF part(s) found`);
        detail.attachments = pdfParts.length;
        msgMetas.push({ seq: msg.seq, uid: msg.uid, detail, hasPdf: pdfParts.length > 0 });
      }
      console.log(`[imap-import] Phase 1 done: ${msgMetas.length} messages, ${msgMetas.filter(m => m.hasPdf).length} with PDFs`);

      // Phase 2: For each message with PDFs, download full source and extract attachments
      for (const meta of msgMetas) {
        const { detail } = meta;

        if (!meta.hasPdf) {
          result.details.push(detail);
          result.processed++;
          continue;
        }

        try {
          // Download the full message source (not specific MIME parts — that hangs on some servers)
          console.log(`[imap-import] Downloading full message ${meta.seq} (UID ${meta.uid})...`);
          const t2 = Date.now();

          let rawBuffer: Buffer;
          try {
            rawBuffer = await downloadPartWithTimeout(client, meta.uid.toString(), undefined, DOWNLOAD_TIMEOUT);
          } catch (dlErr) {
            const dlMsg = dlErr instanceof Error ? dlErr.message : String(dlErr);
            console.warn(`[imap-import] Download failed for message ${meta.seq}: ${dlMsg}`);
            detail.error = `Téléchargement échoué : ${dlMsg}`;
            result.errors.push(detail.error);
            result.details.push(detail);
            result.processed++;
            continue;
          }
          console.log(`[imap-import] Downloaded message ${meta.seq}: ${rawBuffer.length} bytes (${Date.now() - t2}ms)`);

          // Parse raw email to extract PDF attachments
          const attachments = extractPdfAttachments(rawBuffer);
          console.log(`[imap-import] Extracted ${attachments.length} PDF attachment(s) from message ${meta.seq}`);

          if (attachments.length === 0) {
            detail.error = `Aucune pièce jointe PDF trouvée dans l'email (MIME parsing)`;
            result.errors.push(detail.error);
            result.details.push(detail);
            result.processed++;
            continue;
          }

          for (const att of attachments) {
            try {
              // Extract text from PDF
              const t3 = Date.now();
              const { text, usedOcr } = await extractTextFromPdf(att.content);
              console.log(`[imap-import] Text extraction for ${att.filename}: ${text.length} chars, OCR=${usedOcr} (${Date.now() - t3}ms)`);
              if (text.length > 0) {
                console.log(`[imap-import] Text preview: ${text.substring(0, 200)}`);
              }

              if (!text || text.length < 20) {
                await logAudit(null, "EMAIL_IMPORT_OCR_FAILURE", {
                  entityType: "Document",
                  newValue: {
                    filename: att.filename,
                    from: detail.from,
                    subject: detail.subject,
                    usedOcr,
                  },
                });
                detail.error = `Extraction de texte échouée pour ${att.filename} (${text.length} caractères extraits)`;
                result.errors.push(detail.error);
                await notifyHrImportFailure(att.filename, detail.from, detail.subject, "OCR extraction produced no usable text");
                continue;
              }

              // Parse metadata from extracted text
              const metadata = parsePayslipText(text);
              console.log(`[imap-import] Parsed metadata: name=${metadata.employeeName}, email=${metadata.employeeEmail}, type=${metadata.documentType}, month=${metadata.month}, year=${metadata.year}`);

              // Find matching employee (may be null → unassigned doc for HR)
              const employee = await findEmployee(metadata);
              const isUnassigned = !employee;

              // Upload PDF to Vercel Blob
              const blobFolder = employee ? `documents/${employee.id}` : `documents/unassigned`;
              const blobPath = `${blobFolder}/${crypto.randomUUID()}.pdf`;
              const blob = await put(blobPath, att.content, {
                access: "private",
                addRandomSuffix: false,
              });

              // Generate document name
              const monthLabel = metadata.month ? `_${metadata.month}` : "";
              const yearLabel = metadata.year ?? new Date().getFullYear().toString();
              const typeLabel = metadata.documentType === "FICHE_PAIE"
                ? "Fiche_Paie"
                : metadata.documentType.replace(/_/g, "_");
              const docName = `${typeLabel}${monthLabel}-${yearLabel}.pdf`;

              // Create document record (userId = null if no employee match)
              const document = await prisma.document.create({
                data: {
                  userId: employee?.id ?? null,
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
                    ...(isUnassigned ? {
                      unassigned: true,
                      detectedName: metadata.employeeName,
                      detectedEmail: metadata.employeeEmail,
                    } : {}),
                  },
                },
              });

              if (isUnassigned) {
                // Notify HR that a document needs manual assignment
                console.log(`[imap-import] No employee match for ${att.filename} — created unassigned document ${document.id}`);
                await notifyHrUnassignedDocument(
                  document.id,
                  att.filename,
                  detail.from,
                  detail.subject,
                  metadata.employeeName,
                );
              }

              await logAudit(null, isUnassigned ? "EMAIL_IMPORT_UNASSIGNED" : "EMAIL_IMPORT_SUCCESS", {
                entityType: "Document",
                entityId: document.id,
                newValue: {
                  name: document.name,
                  type: document.type,
                  userId: employee?.id ?? null,
                  unassigned: isUnassigned,
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
              detail.error = `Erreur traitement ${att.filename}: ${errMsg}`;
              result.errors.push(detail.error);
            }
          }

          // Mark message as seen after processing
          await client.messageFlagsAdd(meta.uid.toString(), ["\\Seen"], { uid: true });
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
    const lowerMsg = errMsg.toLowerCase();

    // Provide user-friendly error messages for common IMAP failures
    if (lowerMsg.includes("authenticate") || lowerMsg.includes("login") || lowerMsg.includes("credentials") || lowerMsg.includes("no authenticate")) {
      result.errors.push(
        `Échec d'authentification IMAP — le serveur a refusé les identifiants. ` +
        `Pour Outlook/Office365, utilisez un "mot de passe d'application" (pas le mot de passe du compte). ` +
        `Pour Gmail, activez les "mots de passe d'application" dans les paramètres de sécurité Google.`
      );
    } else if (lowerMsg.includes("econnreset") || lowerMsg.includes("econnrefused")) {
      result.errors.push(`Connexion IMAP refusée par ${host}:${port} — vérifiez l'hôte et le port.`);
    } else if (lowerMsg.includes("timeout")) {
      result.errors.push(`Connexion IMAP timeout vers ${host}:${port} — le serveur ne répond pas.`);
    } else {
      result.errors.push(`Erreur IMAP : ${errMsg}`);
    }
  }

  return result;
}

// ─── Helpers ───

/**
 * Download a message (or specific MIME part) with a timeout.
 * When part is undefined, downloads the full message source.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function downloadPartWithTimeout(client: any, uid: string, part: string | undefined, timeout: number): Promise<Buffer> {
  return new Promise<Buffer>(async (resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout après ${timeout / 1000}s — le fichier est peut-être trop volumineux`));
    }, timeout);

    try {
      const downloadMsg = await client.download(uid, part, { uid: true });
      if (!downloadMsg) {
        clearTimeout(timer);
        reject(new Error("Le serveur n'a pas renvoyé de contenu"));
        return;
      }
      const buffer = await streamToBuffer(downloadMsg.content);
      clearTimeout(timer);
      resolve(buffer);
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
}

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
 * Notify HR users when a document is imported but could not be matched to an employee.
 * The document is created with userId = null; HR must assign it manually.
 */
async function notifyHrUnassignedDocument(
  documentId: string,
  filename: string,
  senderEmail: string,
  subject: string,
  detectedName: string | null,
): Promise<void> {
  try {
    const hrUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        roles: { hasSome: ["HR", "ADMIN"] },
      },
      select: { id: true },
    });

    const nameInfo = detectedName ? ` (nom détecté : ${detectedName})` : "";

    for (const hr of hrUsers) {
      await prisma.notification.create({
        data: {
          userId: hr.id,
          type: "DOCUMENT_IMPORT_UNASSIGNED",
          title_fr: `Document importé — affectation requise`,
          title_en: `Document imported — assignment required`,
          body_fr: `Le fichier "${filename}" de ${senderEmail}${nameInfo} a été importé mais aucun employé correspondant n'a été trouvé. Veuillez l'affecter manuellement.`,
          body_en: `File "${filename}" from ${senderEmail}${nameInfo} was imported but no matching employee was found. Please assign it manually.`,
          data: { documentId, filename, senderEmail, subject, detectedName },
        },
      });
    }
  } catch {
    console.error("[email-import] Failed to notify HR about unassigned document");
  }
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
