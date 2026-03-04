/**
 * Tests for src/lib/email-queue.ts — DB-backed email queue
 *
 * Strategy: mock Prisma and email sending to test queue logic.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const mockCreate = jest.fn();
const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockCount = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      create: (...args: any[]) => mockCreate(...args),
      findMany: (...args: any[]) => mockFindMany(...args),
      findUnique: (...args: any[]) => mockFindUnique(...args),
      update: (...args: any[]) => mockUpdate(...args),
      count: (...args: any[]) => mockCount(...args),
    },
  },
}));

const mockSendEmail = jest.fn();
jest.mock("@/lib/email", () => ({
  sendEmail: (...args: any[]) => mockSendEmail(...args),
}));

import { queueEmail, processEmailQueue, getEmailStats } from "@/lib/email-queue";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("queueEmail", () => {
  it("should create an EmailLog record with QUEUED status", async () => {
    mockCreate.mockResolvedValue({ id: "email-log-1" });
    // The immediate send attempt runs in background (void), mock its deps
    mockFindUnique.mockResolvedValue({
      id: "email-log-1",
      status: "QUEUED",
      attempts: 0,
      maxAttempts: 3,
    });
    mockUpdate.mockResolvedValue({});
    mockSendEmail.mockResolvedValue(undefined);

    const id = await queueEmail({
      type: "TENANT_WELCOME" as any,
      to: "test@example.com",
      subject: "Welcome!",
      html: "<p>Hello</p>",
      signupRequestId: "req-1",
      companyId: "company-1",
    });

    expect(id).toBe("email-log-1");
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const createArg = mockCreate.mock.calls[0][0];
    expect(createArg.data.type).toBe("TENANT_WELCOME");
    expect(createArg.data.to).toBe("test@example.com");
    expect(createArg.data.subject).toBe("Welcome!");
    expect(createArg.data.status).toBe("QUEUED");
    expect(createArg.data.maxAttempts).toBe(3);
    expect(createArg.data.signupRequestId).toBe("req-1");
    expect(createArg.data.companyId).toBe("company-1");
    expect(createArg.data.payload).toEqual({ html: "<p>Hello</p>" });
  });

  it("should use default maxAttempts of 3", async () => {
    mockCreate.mockResolvedValue({ id: "email-log-2" });
    mockFindUnique.mockResolvedValue({
      id: "email-log-2",
      status: "QUEUED",
      attempts: 0,
      maxAttempts: 3,
    });
    mockUpdate.mockResolvedValue({});
    mockSendEmail.mockResolvedValue(undefined);

    await queueEmail({
      type: "SIGNUP_REJECTION" as any,
      to: "test@example.com",
      subject: "Rejected",
      html: "<p>Sorry</p>",
    });

    const createArg = mockCreate.mock.calls[0][0];
    expect(createArg.data.maxAttempts).toBe(3);
    expect(createArg.data.signupRequestId).toBeNull();
    expect(createArg.data.companyId).toBeNull();
  });

  it("should allow custom maxAttempts", async () => {
    mockCreate.mockResolvedValue({ id: "email-log-3" });
    mockFindUnique.mockResolvedValue({
      id: "email-log-3",
      status: "QUEUED",
      attempts: 0,
      maxAttempts: 5,
    });
    mockUpdate.mockResolvedValue({});
    mockSendEmail.mockResolvedValue(undefined);

    await queueEmail({
      type: "OTHER" as any,
      to: "test@example.com",
      subject: "Test",
      html: "<p>Test</p>",
      maxAttempts: 5,
    });

    expect(mockCreate.mock.calls[0][0].data.maxAttempts).toBe(5);
  });
});

describe("processEmailQueue", () => {
  it("should process queued emails and mark as SENT on success", async () => {
    const job = {
      id: "job-1",
      type: "TENANT_WELCOME",
      to: "admin@test.com",
      subject: "Welcome",
      payload: { html: "<p>Welcome!</p>" },
      status: "QUEUED",
      attempts: 0,
      maxAttempts: 3,
      signupRequestId: "req-1",
      companyId: "comp-1",
      userId: null,
      nextRetryAt: new Date(),
    };

    mockFindMany.mockResolvedValue([job]);
    mockFindUnique.mockResolvedValue(job);
    mockUpdate.mockResolvedValue({});
    mockSendEmail.mockResolvedValue(undefined);

    const stats = await processEmailQueue(10);

    expect(stats.processed).toBe(1);
    expect(stats.sent).toBe(1);
    expect(stats.failed).toBe(0);
    expect(stats.dead).toBe(0);

    // sendEmail was called with correct args
    expect(mockSendEmail).toHaveBeenCalledWith(
      { to: "admin@test.com", subject: "Welcome", html: "<p>Welcome!</p>" },
      expect.objectContaining({ emailType: "TENANT_WELCOME" })
    );
  });

  it("should mark job as FAILED with retry on send error", async () => {
    const job = {
      id: "job-2",
      type: "SIGNUP_REJECTION",
      to: "user@test.com",
      subject: "Rejected",
      payload: { html: "<p>No</p>" },
      status: "QUEUED",
      attempts: 0,
      maxAttempts: 3,
      signupRequestId: null,
      companyId: null,
      userId: null,
      nextRetryAt: new Date(),
    };

    mockFindMany.mockResolvedValue([job]);
    mockFindUnique
      .mockResolvedValueOnce(job)  // For sendEmailNow
      .mockResolvedValueOnce({ ...job, status: "FAILED", attempts: 1 }); // For stats check
    mockUpdate.mockResolvedValue({});
    mockSendEmail.mockRejectedValue(new Error("SMTP auth failed"));

    const stats = await processEmailQueue(10);

    expect(stats.processed).toBe(1);
    expect(stats.sent).toBe(0);
    expect(stats.failed).toBe(1);
    expect(stats.dead).toBe(0);
  });

  it("should mark job as DEAD when max attempts exhausted", async () => {
    const job = {
      id: "job-3",
      type: "TENANT_WELCOME",
      to: "user@test.com",
      subject: "Welcome",
      payload: { html: "<p>Hi</p>" },
      status: "FAILED",
      attempts: 2,  // Last attempt (maxAttempts = 3)
      maxAttempts: 3,
      signupRequestId: null,
      companyId: null,
      userId: null,
      nextRetryAt: new Date(),
    };

    mockFindMany.mockResolvedValue([job]);
    mockFindUnique
      .mockResolvedValueOnce(job)  // For sendEmailNow
      .mockResolvedValueOnce({ ...job, status: "DEAD", attempts: 3 }); // For stats check
    mockUpdate.mockResolvedValue({});
    mockSendEmail.mockRejectedValue(new Error("Connection refused"));

    const stats = await processEmailQueue(10);

    expect(stats.processed).toBe(1);
    expect(stats.dead).toBe(1);
    expect(stats.sent).toBe(0);
  });

  it("should skip jobs that have exceeded max attempts", async () => {
    const exhaustedJob = {
      id: "job-4",
      attempts: 5,
      maxAttempts: 3,
      nextRetryAt: new Date(),
    };

    mockFindMany.mockResolvedValue([exhaustedJob]);

    const stats = await processEmailQueue(10);

    expect(stats.processed).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("should handle empty queue gracefully", async () => {
    mockFindMany.mockResolvedValue([]);

    const stats = await processEmailQueue(10);

    expect(stats.processed).toBe(0);
    expect(stats.sent).toBe(0);
  });
});

describe("getEmailStats", () => {
  it("should return counts for all statuses", async () => {
    mockCount
      .mockResolvedValueOnce(5)   // queued
      .mockResolvedValueOnce(1)   // sending
      .mockResolvedValueOnce(100) // sent
      .mockResolvedValueOnce(3)   // failed
      .mockResolvedValueOnce(2);  // dead

    const stats = await getEmailStats();

    expect(stats).toEqual({
      queued: 5,
      sending: 1,
      sent: 100,
      failed: 3,
      dead: 2,
      total: 111,
    });

    expect(mockCount).toHaveBeenCalledTimes(5);
  });
});
