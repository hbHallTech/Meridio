import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processIncomingEmails } from "@/lib/document-import";

/**
 * POST /api/admin/import-documents
 *
 * Manual trigger for the email import pipeline.
 * Requires ADMIN role (session-authenticated, for use from the settings UI).
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès réservé Admin" }, { status: 403 });
  }

  try {
    const result = await processIncomingEmails();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[admin/import-documents] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
