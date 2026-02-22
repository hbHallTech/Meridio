import { NextRequest, NextResponse } from "next/server";

/**
 * Hourly cron job for automatic email document import.
 * Connects to IMAP mailbox, fetches unread emails with PDF attachments,
 * extracts metadata via OCR, and creates document records.
 *
 * Secured with DOCS_IMPORT_CRON_SECRET env variable.
 *
 * Usage:
 *   GET /api/cron/import-documents
 *   Authorization: Bearer <DOCS_IMPORT_CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (fail-secure: reject if not configured)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.DOCS_IMPORT_CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Dynamic import to avoid pulling heavy deps at module load time
    const { processIncomingEmails } = await import("@/lib/document-import");
    const result = await processIncomingEmails();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/import-documents] Fatal error:", error);
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
