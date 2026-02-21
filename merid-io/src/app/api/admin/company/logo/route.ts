import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, getIp } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("logo") as File | null;
  const companyId = formData.get("companyId") as string | null;

  if (!companyId) {
    return NextResponse.json({ error: "ID entreprise requis" }, { status: 400 });
  }

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 2Mo)" }, { status: 400 });
  }

  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
  if (!validTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Format invalide. Utilisez JPG, PNG, WebP ou SVG." },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;

  await prisma.company.update({
    where: { id: companyId },
    data: { logoUrl: dataUri },
  });

  logAudit(session.user.id, "COMPANY_LOGO_UPDATED", {
    entityType: "Company",
    entityId: companyId,
    ip: getIp(request.headers),
    newValue: { fileType: file.type, fileSize: file.size },
  });

  return NextResponse.json({ logoUrl: dataUri });
}
