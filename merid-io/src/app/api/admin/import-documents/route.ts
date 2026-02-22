import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * POST /api/admin/import-documents
 *
 * Manual trigger for the email import pipeline.
 * Requires ADMIN or HR role (session-authenticated, for use from the settings UI).
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("HR")) {
    return NextResponse.json({ error: "Accès réservé Admin/RH" }, { status: 403 });
  }

  try {
    // Dynamic import to avoid pulling heavy deps at module load time
    const { processIncomingEmails } = await import("@/lib/document-import");

    // Route-level timeout: 25 seconds (Vercel hobby = 10s, pro = 60s)
    const ROUTE_TIMEOUT = 25_000;
    const result = await Promise.race([
      processIncomingEmails(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Import timeout — the operation took too long. Check IMAP settings.")), ROUTE_TIMEOUT)
      ),
    ]);

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[admin/import-documents] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: message,
        processed: 0,
        created: 0,
        errors: [message],
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
