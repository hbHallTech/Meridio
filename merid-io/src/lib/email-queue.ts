import { prisma } from "@/lib/prisma";
import type { EmailType, EmailStatus } from "@prisma/client";

/**
 * DB-backed email queue for reliable email delivery.
 *
 * Why DB instead of BullMQ/Redis:
 * - Meridio runs on Vercel serverless — no persistent worker process
 * - Existing cron pattern (/api/cron/*) handles background jobs
 * - No Redis infrastructure to manage
 * - Full traceability via EmailLog table visible to SUPER_ADMIN
 *
 * Flow:
 * 1. API route calls queueEmail() → persists job to EmailLog (QUEUED)
 * 2. Cron endpoint /api/cron/process-emails picks up QUEUED/retryable jobs
 * 3. On success → SENT; on failure → increment attempts, schedule retry
 * 4. After maxAttempts → DEAD (dead-letter equivalent)
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
 * Enqueue an email for reliable delivery.
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
      nextRetryAt: new Date(), // Available immediately
      signupRequestId: options.signupRequestId ?? null,
      companyId: options.companyId ?? null,
      userId: options.userId ?? null,
    },
  });

  console.log(
    `[email-queue] Enqueued: id=${log.id} type=${options.type} to=${options.to} subject="${options.subject}"`
  );

  return log.id;
}

/**
 * Process pending emails from the queue.
 * Called by /api/cron/process-emails.
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

    // Mark as SENDING to prevent concurrent processing
    await prisma.emailLog.update({
      where: { id: job.id },
      data: { status: "SENDING", attempts: job.attempts + 1 },
    });

    try {
      // Dynamic import to avoid circular dependency
      const { sendEmail } = await import("@/lib/email");
      const payload = job.payload as { html: string };

      await sendEmail(
        { to: job.to, subject: job.subject, html: payload.html },
        {
          emailType: job.type,
          signupRequestId: job.signupRequestId ?? undefined,
          companyId: job.companyId ?? undefined,
          userId: job.userId ?? undefined,
        }
      );

      await prisma.emailLog.update({
        where: { id: job.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null },
      });
      stats.sent++;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const newAttempts = job.attempts + 1;
      const isDead = newAttempts >= job.maxAttempts;

      // Exponential backoff: 30s, 2min, 8min
      const backoffMs = Math.min(30_000 * Math.pow(4, job.attempts), 600_000);
      const nextRetry = isDead ? null : new Date(Date.now() + backoffMs);

      await prisma.emailLog.update({
        where: { id: job.id },
        data: {
          status: isDead ? "DEAD" : "FAILED",
          lastError: errMsg.substring(0, 1000),
          nextRetryAt: nextRetry,
        },
      });

      if (isDead) {
        console.error(
          `[email-queue] DEAD LETTER: id=${job.id} type=${job.type} to=${job.to} ` +
          `after ${newAttempts} attempts. Last error: ${errMsg}`
        );
        stats.dead++;
      } else {
        console.warn(
          `[email-queue] Retry scheduled: id=${job.id} attempt=${newAttempts}/${job.maxAttempts} ` +
          `nextRetry=${nextRetry?.toISOString()} error=${errMsg}`
        );
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
