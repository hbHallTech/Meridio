import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { logAudit, getIp } from "@/lib/audit";
import { documentCreateSchema, documentListQuerySchema } from "@/lib/validators";
import crypto from "crypto";
import path from "path";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB for documents
const ALLOWED_TYPES = ["application/pdf"];

/**
 * Check if the documents module is enabled at company level.
 */
async function isModuleEnabled(): Promise<boolean> {
  const company = await prisma.company.findFirst({
    select: { documentsModuleEnabled: true },
  });
  return company?.documentsModuleEnabled ?? false;
}

// ─── POST /api/documents — Upload + create document (HR/ADMIN only) ───

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("HR") && !roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès réservé RH/Admin" }, { status: 403 });
  }

  if (!(await isModuleEnabled())) {
    return NextResponse.json({ error: "Module Documents désactivé" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  // Validate file
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Seuls les fichiers PDF sont acceptés" },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Fichier trop volumineux (max 10 Mo)" },
      { status: 400 }
    );
  }

  // Validate metadata fields from form
  const body = {
    userId: formData.get("userId") as string,
    name: formData.get("name") as string,
    type: formData.get("type") as string,
    metadata: formData.get("metadata")
      ? JSON.parse(formData.get("metadata") as string)
      : undefined,
  };

  const parsed = documentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Verify target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { id: true },
  });
  if (!targetUser) {
    return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });
  }

  try {
    // Upload to Vercel Blob in isolated path per user
    const ext = path.extname(file.name) || ".pdf";
    const uniqueName = `documents/${data.userId}/${crypto.randomUUID()}${ext}`;

    const blob = await put(uniqueName, file, {
      access: "private",
      addRandomSuffix: false,
    });

    // Create DB record
    const document = await prisma.document.create({
      data: {
        userId: data.userId,
        name: data.name,
        type: data.type as "FICHE_PAIE" | "ATTESTATION_TRAVAIL" | "CERTIFICAT_TRAVAIL" | "CONTRAT" | "AUTRE",
        filePath: blob.url,
        fileSize: file.size,
        mimeType: file.type,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
        createdById: session.user.id,
      },
    });

    logAudit(session.user.id, "DOCUMENT_CREATED", {
      ip: getIp(request.headers),
      entityType: "Document",
      entityId: document.id,
      newValue: {
        name: data.name,
        type: data.type,
        userId: data.userId,
        fileSize: file.size,
      },
    });

    return NextResponse.json(
      {
        id: document.id,
        name: document.name,
        type: document.type,
        status: document.status,
        fileSize: document.fileSize,
        metadata: document.metadata,
        createdAt: document.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[documents] Create error: ${errMsg}`);
    return NextResponse.json(
      { error: "Erreur lors de la création du document" },
      { status: 500 }
    );
  }
}

// ─── GET /api/documents — List documents for current user (employee) ───

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!(await isModuleEnabled())) {
    return NextResponse.json({ error: "Module Documents désactivé" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const queryRaw = Object.fromEntries(searchParams.entries());
  const parsed = documentListQuerySchema.safeParse(queryRaw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { type, status, mois, annee, search, limit, offset } = parsed.data;

  // Determine whose documents to list
  const roles = session.user.roles ?? [];
  const isHrOrAdmin = roles.includes("HR") || roles.includes("ADMIN");
  const queryUserId = searchParams.get("userId");

  // HR/Admin can list any user's docs via ?userId=, employees only see their own
  // Special value "unassigned" lists documents with no userId (pending HR assignment)
  const isUnassigned = queryUserId === "unassigned" && isHrOrAdmin;
  let targetUserId = session.user.id;
  if (queryUserId && queryUserId !== "unassigned" && isHrOrAdmin) {
    targetUserId = queryUserId;
  } else if (queryUserId && !isHrOrAdmin) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    userId: isUnassigned ? null : targetUserId,
    status: { not: "DELETED" },
  };

  if (type) where.type = type;
  if (status) where.status = status;

  // Filter by metadata month/year
  if (mois || annee) {
    const metadataFilter: Record<string, string> = {};
    if (mois) metadataFilter.mois = mois;
    if (annee) metadataFilter.annee = annee;
    where.metadata = { path: Object.keys(metadataFilter), equals: undefined };
    // Use Prisma JSON filtering
    const conditions = [];
    if (mois) conditions.push({ metadata: { path: ["mois"], equals: mois } });
    if (annee) conditions.push({ metadata: { path: ["annee"], equals: annee } });
    if (conditions.length > 0) {
      where.AND = conditions;
      delete where.metadata;
    }
  }

  // Full-text search on name
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  try {
    const [items, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          userId: true,
          name: true,
          type: true,
          status: true,
          fileSize: true,
          mimeType: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: { firstName: true, lastName: true },
          },
          createdBy: {
            select: { firstName: true, lastName: true },
          },
        },
      }),
      prisma.document.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      limit,
      offset,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[documents] List error: ${errMsg}`);
    return NextResponse.json(
      { error: "Erreur lors du chargement des documents" },
      { status: 500 }
    );
  }
}
