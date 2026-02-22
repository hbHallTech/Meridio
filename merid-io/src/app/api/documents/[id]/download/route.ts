import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { get } from "@vercel/blob";
import { logAudit, getIp } from "@/lib/audit";

/**
 * GET /api/documents/:id/download
 *
 * Secure download proxy for document files stored in Vercel Blob.
 * Validates ownership (owner, HR, or Admin) before streaming.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id },
    select: { id: true, userId: true, name: true, filePath: true, mimeType: true, status: true },
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

  try {
    const result = await get(document.filePath, { access: "private" });

    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }

    const { stream, blob } = result;

    // Determine if inline view or download based on query param
    const disposition = request.nextUrl.searchParams.get("disposition") === "attachment"
      ? "attachment"
      : "inline";

    logAudit(session.user.id, "DOCUMENT_DOWNLOADED", {
      ip: getIp(request.headers),
      entityType: "Document",
      entityId: id,
      newValue: { name: document.name, disposition },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": document.mimeType || blob.contentType,
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(document.name)}"`,
        "Content-Length": String(blob.size),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[documents] Download error: doc=${id} error=${errMsg}`);
    return NextResponse.json(
      { error: "Impossible de télécharger le fichier" },
      { status: 500 }
    );
  }
}
