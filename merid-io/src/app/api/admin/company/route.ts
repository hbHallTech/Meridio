import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const companies = await prisma.company.findMany({
    include: {
      _count: { select: { offices: true } },
      offices: {
        select: {
          id: true,
          name: true,
          country: true,
          city: true,
          _count: { select: { users: true } },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  return NextResponse.json(companies[0] ?? null);
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, name, websiteUrl, logoUrl } = body;

    if (!id) {
      return NextResponse.json({ error: "L'identifiant de l'entreprise est requis" }, { status: 400 });
    }

    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (websiteUrl !== undefined) updateData.websiteUrl = websiteUrl || null;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl || null;

    const oldValue = {
      name: existing.name,
      websiteUrl: existing.websiteUrl,
      logoUrl: existing.logoUrl ? "(image)" : null,
    };

    const company = await prisma.company.update({
      where: { id },
      data: updateData,
      include: {
        _count: { select: { offices: true } },
        offices: {
          select: {
            id: true,
            name: true,
            country: true,
            city: true,
            _count: { select: { users: true } },
          },
          orderBy: { name: "asc" },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: "COMPANY_UPDATED",
        entityType: "Company",
        entityId: id,
        oldValue,
        newValue: updateData as Record<string, string | number | boolean | null>,
      },
    });

    return NextResponse.json(company);
  } catch (error) {
    console.error("PATCH /api/admin/company error:", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour de l'entreprise" }, { status: 500 });
  }
}
