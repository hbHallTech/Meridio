import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyLeaveReminder } from "@/lib/notifications";

// GET /api/cron/reminders?secret=xxx
// Protected by a secret token (Vercel Cron or manual trigger)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Find pending requests older than 48h that haven't been reminded in the last 24h
  const pendingRequests = await prisma.leaveRequest.findMany({
    where: {
      status: { in: ["PENDING_MANAGER", "PENDING_HR"] },
      createdAt: { lt: twoDaysAgo },
      OR: [
        { lastReminderSentAt: null },
        { lastReminderSentAt: { lt: oneDayAgo } },
      ],
    },
    select: { id: true },
  });

  let sent = 0;
  let errors = 0;

  for (const req of pendingRequests) {
    try {
      // Use a transaction to prevent concurrent reminder sends
      await prisma.$transaction(async (tx) => {
        // Re-check inside transaction to avoid race conditions
        const fresh = await tx.leaveRequest.findUnique({
          where: { id: req.id },
          select: { lastReminderSentAt: true, status: true },
        });

        if (!fresh) return;
        if (fresh.status !== "PENDING_MANAGER" && fresh.status !== "PENDING_HR") return;
        if (fresh.lastReminderSentAt && fresh.lastReminderSentAt > oneDayAgo) return;

        // Mark as reminded FIRST to prevent duplicates
        await tx.leaveRequest.update({
          where: { id: req.id },
          data: { lastReminderSentAt: now },
        });
      });

      // Send notification outside transaction (email is external side-effect)
      await notifyLeaveReminder(req.id);
      sent++;
    } catch (err) {
      console.error(`[CRON] Reminder error for ${req.id}:`, err);
      errors++;
    }
  }

  return NextResponse.json({
    ok: true,
    found: pendingRequests.length,
    sent,
    errors,
    timestamp: now.toISOString(),
  });
}
