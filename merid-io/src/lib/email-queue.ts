import { prisma } from "@/lib/prisma";
import type { EmailType, EmailStatus } from "@prisma/client";

/**
 * DB-backed email queue for reliable email delivery.
 *
 * Strategy: "send immediately, queue as safety net"
 * 1. queueEmail() persists to EmailLog, then attempts immediate delivery
 * 2. If immediate send succeeds → mark SENT, done
 * 3. If immediate send fails → stays QUEUED for cron retry
 * 4. Cron /api/cron/process-emails retries QUEUED/FAILED jobs
 * 5. After maxAttempts → DEAD (dead-letter)
 *
 * This ensures emails are sent in the same request (no cron delay)
 * while still having retry capability for transient failures.
 */

export interface QueueEmailOptions {
  type: EmailType;
  to: string;
  subject: string;
  html: string;
  maxAttempts?: number;
  signupRequestId?: string;
  companyId?: string;
  userId?: string;
}

/**
 * Enqueue an email and attempt immediate delivery.
 *
 * - Persists to EmailLog first (crash-safe)
 * - Tries to send right away
 * - On success: marks SENT
 * - On failure: logs error, leaves as QUEUED for cron retry
 *
 * Returns the EmailLog id for tracking.
 */
export async function queueEmail(options: QueueEmailOptions): Promise<string> {
  const log = await prisma.emailLog.create({
    data: {
      type: options.type,
      to: options.to,
      subject: options.subject,
      payload: { html: options.html },
      status: "QUEUED",
      maxAttempts: options.maxAttempts ?? 3,
      nextRetryAt: new Date(), // Available for cron immediately if direct send fails
      signupRequestId: options.signupRequestId ?? null,
      companyId: options.companyId ?? null,
      userId: options.userId ?? null,
    },
  });

  console.log(
    `[email-queue] Enqueued: id=${log.id} type=${options.type} to=${options.to} subject="${options.subject}"`
  );

  // Attempt immediate delivery (best-effort, non-blocking for the caller)
  // We don't await this — the API response returns immediately with the emailLogId
  void sendEmailNow(log.id, options).catch(() => {
    // Error already logged inside sendEmailNow; job stays QUEUED for cron retry
  });

  return log.id;
}

/**
 * Attempt to send an email immediately and update its EmailLog status.
 * Used both by queueEmail() (immediate) and processEmailQueue() (cron retry).
 */
async function sendEmailNow(
  emailLogId: string,
  options: { type: EmailType; to: string; subject: string; html: string; signupRequestId?: string | null; companyId?: string | null; userId?: string | null }
) {
  // Mark as SENDING + increment attempts
  const current = await prisma.emailLog.findUnique({ where: { id: emailLogId } });
  if (!current || current.status === "SENT" || current.status === "DEAD") return;

  const newAttempts = current.attempts + 1;

  await prisma.emailLog.update({
    where: { id: emailLogId },
    data: { status: "SENDING", attempts: newAttempts },
  });

  try {
    const { sendEmail } = await import("@/lib/email");

    await sendEmail(
      { to: options.to, subject: options.subject, html: options.html },
      {
        emailType: String(options.type),
        signupRequestId: options.signupRequestId ?? undefined,
        companyId: options.companyId ?? undefined,
        userId: options.userId ?? undefined,
      }
    );

    await prisma.emailLog.update({
      where: { id: emailLogId },
      data: { status: "SENT", sentAt: new Date(), lastError: null },
    });

    console.log(`[email-queue] Sent immediately: id=${emailLogId} to=${options.to}`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const isDead = newAttempts >= (current.maxAttempts || 3);

    // Exponential backoff for cron retry: 30s, 2min, 8min
    const backoffMs = Math.min(30_000 * Math.pow(4, current.attempts), 600_000);
    const nextRetry = isDead ? null : new Date(Date.now() + backoffMs);

    await prisma.emailLog.update({
      where: { id: emailLogId },
      data: {
        status: isDead ? "DEAD" : "FAILED",
        lastError: errMsg.substring(0, 1000),
        nextRetryAt: nextRetry,
      },
    });

    if (isDead) {
      console.error(
        `[email-queue] DEAD LETTER: id=${emailLogId} type=${options.type} to=${options.to} ` +
        `after ${newAttempts} attempts. Last error: ${errMsg}`
      );
    } else {
      console.warn(
        `[email-queue] Send failed, will retry via cron: id=${emailLogId} ` +
        `attempt=${newAttempts}/${current.maxAttempts} error=${errMsg}`
      );
    }

    throw error; // Re-throw so caller knows it failed
  }
}

/**
 * Process pending emails from the queue.
 * Called by /api/cron/process-emails.
 *
 * Picks up FAILED jobs that are due for retry (nextRetryAt <= now).
 * QUEUED jobs that failed immediate send also get retried here.
 *
 * Returns { processed, sent, failed, dead } counts.
 */
export async function processEmailQueue(batchSize = 20) {
  const now = new Date();

  // Fetch emails that are ready to process.
  // Prisma can't compare two columns directly (attempts < maxAttempts),
  // so we fetch candidates and filter in-app.
  const jobs = await prisma.emailLog.findMany({
    where: {
      status: { in: ["QUEUED", "FAILED"] as EmailStatus[] },
      nextRetryAt: { lte: now },
    },
    orderBy: { nextRetryAt: "asc" },
    take: batchSize * 2, // Over-fetch to compensate for in-app filtering
  });

  const eligible = jobs.filter((j) => j.attempts < j.maxAttempts).slice(0, batchSize);

  const stats = { processed: 0, sent: 0, failed: 0, dead: 0 };

  for (const job of eligible) {
    stats.processed++;
    const payload = job.payload as { html: string };

    try {
      await sendEmailNow(job.id, {
        type: job.type,
        to: job.to,
        subject: job.subject,
        html: payload.html,
        signupRequestId: job.signupRequestId,
        companyId: job.companyId,
        userId: job.userId,
      });
      stats.sent++;
    } catch {
      // sendEmailNow already updated the DB status
      const updated = await prisma.emailLog.findUnique({ where: { id: job.id } });
      if (updated?.status === "DEAD") {
        stats.dead++;
      } else {
        stats.failed++;
      }
    }
  }

  return stats;
}

/**
 * Get email delivery stats for super admin dashboard.
 */
export async function getEmailStats() {
  const [queued, sending, sent, failed, dead] = await Promise.all([
    prisma.emailLog.count({ where: { status: "QUEUED" } }),
    prisma.emailLog.count({ where: { status: "SENDING" } }),
    prisma.emailLog.count({ where: { status: "SENT" } }),
    prisma.emailLog.count({ where: { status: "FAILED" } }),
    prisma.emailLog.count({ where: { status: "DEAD" } }),
  ]);
  return { queued, sending, sent, failed, dead, total: queued + sending + sent + failed + dead };
}

/**
 * Get recent failed/dead emails for super admin visibility.
 */
export async function getFailedEmails(limit = 20) {
  return prisma.emailLog.findMany({
    where: { status: { in: ["FAILED", "DEAD"] } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      to: true,
      subject: true,
      status: true,
      attempts: true,
      maxAttempts: true,
      lastError: true,
      nextRetryAt: true,
      createdAt: true,
      updatedAt: true,
      signupRequestId: true,
      companyId: true,
    },
  });
}
