import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { get } from "@vercel/blob";
import { logAudit, getIp } from "@/lib/audit";

/**
 * GET /api/attachments?url=<blobUrl>
 *
 * Secure proxy for private Vercel Blob files.
 * Validates authentication, fetches the blob server-side, and streams it to the client.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const blobUrl = request.nextUrl.searchParams.get("url");
  if (!blobUrl) {
    return NextResponse.json({ error: "URL manquante" }, { status: 400 });
  }

  try {
    const result = await get(blobUrl, { access: "private" });

    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }

    const { stream, blob } = result;

    // Extract filename from pathname (e.g. "attachments/uuid.pdf" → "uuid.pdf")
    const fileName = blob.pathname.split("/").pop() ?? "download";

    logAudit(session.user.id, "DOWNLOAD_ATTACHMENT", {
      ip: getIp(request.headers),
      entityType: "Attachment",
      newValue: { pathname: blob.pathname, size: blob.size },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": blob.contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Content-Length": String(blob.size),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[attachments] Download error: user=${session.user.id} url=${blobUrl} error=${errMsg}`);
    return NextResponse.json(
      { error: "Impossible de télécharger le fichier" },
      { status: 500 }
    );
  }
}
