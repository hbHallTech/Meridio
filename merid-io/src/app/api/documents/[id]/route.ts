import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, getIp } from "@/lib/audit";
import { documentUpdateSchema } from "@/lib/validators";

/**
 * Check if the documents module is enabled at company level.
 */
async function isModuleEnabled(): Promise<boolean> {
  const company = await prisma.company.findFirst({
    select: { documentsModuleEnabled: true },
  });
  return company?.documentsModuleEnabled ?? false;
}

// ─── GET /api/documents/:id — Get single document (with ownership check) ───

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!(await isModuleEnabled())) {
    return NextResponse.json({ error: "Module Documents désactivé" }, { status: 403 });
  }

  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      modifiedBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!document || document.status === "DELETED") {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  // Access control: owner, HR, or Admin
  const roles = session.user.roles ?? [];
  const isOwner = document.userId === session.user.id;
  const isHrOrAdmin = roles.includes("HR") || roles.includes("ADMIN");

  if (!isOwner && !isHrOrAdmin) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  // Auto-mark as OUVERT when the owner views it for the first time
  if (isOwner && document.status === "NOUVEAU") {
    await prisma.document.update({
      where: { id },
      data: { status: "OUVERT" },
    });
    document.status = "OUVERT";
  }

  logAudit(session.user.id, "DOCUMENT_VIEWED", {
    ip: getIp(request.headers),
    entityType: "Document",
    entityId: id,
    newValue: {
      name: document.name,
      type: document.type,
      accessType: isOwner ? "owner" : "privileged",
      targetUserId: document.userId,
    },
  });

  return NextResponse.json({
    id: document.id,
    name: document.name,
    type: document.type,
    status: document.status,
    filePath: document.filePath,
    fileSize: document.fileSize,
    mimeType: document.mimeType,
    metadata: document.metadata,
    user: document.user,
    createdBy: document.createdBy,
    modifiedBy: document.modifiedBy,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  });
}

// ─── PATCH /api/documents/:id — Update metadata/status (HR/Admin or owner for status) ───

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!(await isModuleEnabled())) {
    return NextResponse.json({ error: "Module Documents désactivé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const parsed = documentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const document = await prisma.document.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true, name: true, type: true },
  });

  if (!document || document.status === "DELETED") {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  const roles = session.user.roles ?? [];
  const isOwner = document.userId === session.user.id;
  const isHrOrAdmin = roles.includes("HR") || roles.includes("ADMIN");

  // Employees can only update status (mark as OUVERT/ARCHIVE)
  // HR/Admin can update all fields
  if (!isOwner && !isHrOrAdmin) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const data = parsed.data;

  // Employees can only change status
  if (isOwner && !isHrOrAdmin) {
    if (data.name || data.type || data.metadata) {
      return NextResponse.json(
        { error: "Seul le statut peut être modifié" },
        { status: 403 }
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = { modifiedById: session.user.id };
  if (data.name) updateData.name = data.name;
  if (data.type) updateData.type = data.type;
  if (data.status) updateData.status = data.status;
  if (data.metadata !== undefined) updateData.metadata = data.metadata;

  const updated = await prisma.document.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      metadata: true,
      updatedAt: true,
    },
  });

  logAudit(session.user.id, "DOCUMENT_UPDATED", {
    ip: getIp(request.headers),
    entityType: "Document",
    entityId: id,
    oldValue: { name: document.name, type: document.type, status: document.status },
    newValue: JSON.parse(JSON.stringify(data)),
  });

  return NextResponse.json(updated);
}

// ─── DELETE /api/documents/:id — Soft-delete (HR/Admin only) ───

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id },
    select: { id: true, name: true, type: true, status: true, filePath: true },
  });

  if (!document || document.status === "DELETED") {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  // Soft-delete: mark as DELETED (file kept in blob for retention/compliance)
  await prisma.document.update({
    where: { id },
    data: { status: "DELETED", modifiedById: session.user.id },
  });

  logAudit(session.user.id, "DOCUMENT_DELETED", {
    ip: getIp(request.headers),
    entityType: "Document",
    entityId: id,
    oldValue: { name: document.name, type: document.type },
  });

  return NextResponse.json({ success: true });
}
