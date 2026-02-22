import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, getIp } from "@/lib/audit";
import { templateCreateSchema, templateUpdateSchema } from "@/lib/validators";

// ─── GET /api/admin/templates — List all templates ───

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("HR") && !roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès réservé RH/Admin" }, { status: 403 });
  }

  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) {
    return NextResponse.json([]);
  }

  const templates = await prisma.documentTemplate.findMany({
    where: { companyId: company.id },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(templates);
}

// ─── POST /api/admin/templates — Create template ───

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("HR") && !roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès réservé RH/Admin" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = templateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) {
    return NextResponse.json({ error: "Entreprise non configurée" }, { status: 400 });
  }

  const data = parsed.data;

  // Check name uniqueness within company
  const existing = await prisma.documentTemplate.findUnique({
    where: { companyId_name: { companyId: company.id, name: data.name } },
  });
  if (existing) {
    return NextResponse.json({ error: "Un template avec ce nom existe déjà" }, { status: 409 });
  }

  // If setting as default, unset other defaults for this type
  if (data.isDefault) {
    await prisma.documentTemplate.updateMany({
      where: { companyId: company.id, type: data.type, isDefault: true },
      data: { isDefault: false },
    });
  }

  const template = await prisma.documentTemplate.create({
    data: {
      companyId: company.id,
      name: data.name,
      type: data.type,
      subject: data.subject ?? null,
      content: data.content,
      variables: data.variables ?? [],
      isActive: data.isActive ?? true,
      isDefault: data.isDefault ?? false,
    },
  });

  logAudit(session.user.id, "TEMPLATE_CREATED", {
    ip: getIp(request.headers),
    entityType: "DocumentTemplate",
    entityId: template.id,
    newValue: { name: template.name, type: template.type },
  });

  return NextResponse.json(template, { status: 201 });
}

// ─── PATCH /api/admin/templates — Update template ───

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("HR") && !roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès réservé RH/Admin" }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...fields } = body;

  if (!id) {
    return NextResponse.json({ error: "L'identifiant du template est requis" }, { status: 400 });
  }

  const parsed = templateUpdateSchema.safeParse(fields);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await prisma.documentTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Template introuvable" }, { status: 404 });
  }

  const data = parsed.data;

  // Check name uniqueness if changing name
  if (data.name && data.name !== existing.name) {
    const duplicate = await prisma.documentTemplate.findUnique({
      where: { companyId_name: { companyId: existing.companyId, name: data.name } },
    });
    if (duplicate) {
      return NextResponse.json({ error: "Un template avec ce nom existe déjà" }, { status: 409 });
    }
  }

  // If setting as default, unset other defaults for this type
  if (data.isDefault) {
    const targetType = data.type ?? existing.type;
    await prisma.documentTemplate.updateMany({
      where: { companyId: existing.companyId, type: targetType, isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.subject !== undefined) updateData.subject = data.subject;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.variables !== undefined) updateData.variables = data.variables;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

  const template = await prisma.documentTemplate.update({
    where: { id },
    data: updateData,
  });

  logAudit(session.user.id, "TEMPLATE_UPDATED", {
    ip: getIp(request.headers),
    entityType: "DocumentTemplate",
    entityId: id,
    oldValue: { name: existing.name, type: existing.type },
    newValue: JSON.parse(JSON.stringify(data)),
  });

  return NextResponse.json(template);
}

// ─── DELETE /api/admin/templates — Delete template ───

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("HR") && !roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès réservé RH/Admin" }, { status: 403 });
  }

  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "L'identifiant du template est requis" }, { status: 400 });
  }

  const existing = await prisma.documentTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Template introuvable" }, { status: 404 });
  }

  await prisma.documentTemplate.delete({ where: { id } });

  logAudit(session.user.id, "TEMPLATE_DELETED", {
    ip: getIp(request.headers),
    entityType: "DocumentTemplate",
    entityId: id,
    oldValue: { name: existing.name, type: existing.type },
  });

  return NextResponse.json({ success: true });
}
