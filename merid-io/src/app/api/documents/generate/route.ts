import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { logAudit, getIp } from "@/lib/audit";
import { generateAttestationPdf, type AttestationData } from "@/lib/pdf-generator";
import crypto from "crypto";
import { z } from "zod";

const generateSchema = z.object({
  type: z.enum(["ATTESTATION_TRAVAIL", "CERTIFICAT_TRAVAIL"]),
  userId: z.string().min(1).optional(), // HR/Admin can generate for any user
});

/**
 * POST /api/documents/generate
 *
 * Generate an attestation or certificate PDF.
 * - Employees can generate for themselves only.
 * - HR/Admin can specify a userId to generate for any employee.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Check module enabled
  const company = await prisma.company.findFirst({
    select: {
      id: true,
      documentsModuleEnabled: true,
      name: true,
      legalForm: true,
      address: true,
      addressComplement: true,
      postalCode: true,
      city: true,
      country: true,
      contactFirstName: true,
      contactLastName: true,
      logoUrl: true,
    },
  });

  if (!company?.documentsModuleEnabled) {
    return NextResponse.json(
      { error: "Module Documents désactivé" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { type } = parsed.data;
  const roles = session.user.roles ?? [];
  const isHrOrAdmin = roles.includes("HR") || roles.includes("ADMIN");

  // Determine target user
  let targetUserId = session.user.id;
  if (parsed.data.userId) {
    if (!isHrOrAdmin) {
      return NextResponse.json(
        { error: "Seul RH/Admin peut générer pour un autre employé" },
        { status: 403 }
      );
    }
    targetUserId = parsed.data.userId;
  }

  // Fetch target user with office
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      hireDate: true,
      isActive: true,
      office: {
        select: {
          name: true,
          city: true,
          country: true,
        },
      },
    },
  });

  if (!targetUser || !targetUser.isActive) {
    return NextResponse.json(
      { error: "Employé introuvable ou inactif" },
      { status: 404 }
    );
  }

  // Find matching template (default first, then any active)
  const template = await prisma.documentTemplate.findFirst({
    where: {
      companyId: company.id,
      type,
      isActive: true,
    },
    orderBy: { isDefault: "desc" },
    select: { content: true },
  });

  // Build attestation data
  const attestationData: AttestationData = {
    employeeFirstName: targetUser.firstName,
    employeeLastName: targetUser.lastName,
    employeeEmail: targetUser.email,
    hireDate: targetUser.hireDate,
    officeName: targetUser.office.name,
    officeCity: targetUser.office.city,
    officeCountry: targetUser.office.country,
    companyName: company.name,
    companyAddress: company.address,
    companyPostalCode: company.postalCode,
    companyCity: company.city,
    companyCountry: company.country,
    companyLegalForm: company.legalForm ? ` (${company.legalForm})` : null,
    contactFirstName: company.contactFirstName,
    contactLastName: company.contactLastName,
    companyLogoUrl: company.logoUrl,
    documentType: type,
    templateContent: template?.content ?? null,
    generatedDate: new Date(),
  };

  // Generate PDF
  const pdfBytes = await generateAttestationPdf(attestationData);
  const pdfBuffer = Buffer.from(pdfBytes);

  // Upload to Vercel Blob
  const blobPath = `documents/${targetUserId}/${crypto.randomUUID()}.pdf`;
  const blob = await put(blobPath, pdfBuffer, {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/pdf",
  });

  // Build document name
  const typeLabel =
    type === "ATTESTATION_TRAVAIL" ? "Attestation_Travail" : "Certificat_Travail";
  const now = new Date();
  const dateStr = `${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
  const docName = `${typeLabel}_${targetUser.lastName}_${dateStr}.pdf`;

  // Create document record
  const document = await prisma.document.create({
    data: {
      userId: targetUserId,
      name: docName,
      type,
      status: "NOUVEAU",
      filePath: blob.url,
      fileSize: pdfBuffer.length,
      mimeType: "application/pdf",
      createdById: session.user.id,
      metadata: {
        mois: String(now.getMonth() + 1).padStart(2, "0"),
        annee: String(now.getFullYear()),
        source: "generated",
        generatedBy: session.user.id,
      },
    },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      fileSize: true,
      createdAt: true,
    },
  });

  logAudit(session.user.id, "DOCUMENT_CREATED", {
    ip: getIp(request.headers),
    entityType: "Document",
    entityId: document.id,
    newValue: {
      name: docName,
      type,
      userId: targetUserId,
      source: "generated",
    },
  });

  return NextResponse.json({
    success: true,
    document,
  });
}
