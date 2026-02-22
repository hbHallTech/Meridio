import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Allow up to 300s on Vercel Pro (hobby is capped at 10s regardless)
// Email download + PDF extraction + optional OCR can take a while
export const maxDuration = 300;

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

    const t0 = Date.now();
    const result = await processIncomingEmails();
    const elapsed = Date.now() - t0;
    console.log(`[admin/import-documents] Completed in ${elapsed}ms — processed: ${result.processed}, created: ${result.created}, errors: ${result.errors.length}`);

    // Surface errors: if there are errors and no docs created, mark as failure
    const hasErrors = result.errors.length > 0;
    const success = result.created > 0 || (!hasErrors && result.processed >= 0);

    return NextResponse.json({
      success,
      ...result,
      elapsed,
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
