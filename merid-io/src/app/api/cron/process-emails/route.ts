import { NextRequest, NextResponse } from "next/server";
import { processEmailQueue } from "@/lib/email-queue";

/**
 * GET /api/cron/process-emails
 *
 * Cron job to process the email queue (retry failed emails, send queued ones).
 * Should be called every 1–5 minutes via Vercel cron or external scheduler.
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await processEmailQueue(20);

    console.log(
      `[cron/process-emails] Done: processed=${stats.processed} sent=${stats.sent} ` +
      `failed=${stats.failed} dead=${stats.dead}`
    );

    return NextResponse.json({ success: true, ...stats });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[cron/process-emails] Error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
