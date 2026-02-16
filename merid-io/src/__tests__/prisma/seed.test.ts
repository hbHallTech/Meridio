/**
 * Tests for prisma/seed.ts — admin seed script
 *
 * Strategy: mock PrismaClient and bcrypt, then dynamically import the seed
 * module (which calls main() at the top level). After execution we assert
 * that every expected upsert / create / update was issued with the right data.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Mock holders ────────────────────────────────────────────────────────────

const mockCompanyUpsert = jest.fn();
const mockOfficeUpsert = jest.fn();
const mockLeaveTypeConfigUpsert = jest.fn();
const mockWorkflowConfigUpsert = jest.fn();
const mockWorkflowStepUpsert = jest.fn();
const mockExceptionalLeaveRuleFindFirst = jest.fn();
const mockExceptionalLeaveRuleUpdate = jest.fn();
const mockExceptionalLeaveRuleCreate = jest.fn();
const mockUserUpsert = jest.fn();
const mockLeaveBalanceUpsert = jest.fn();
const mockPublicHolidayUpsert = jest.fn();
const mockPublicHolidayFindUnique = jest.fn();
const mockPublicHolidayUpdate = jest.fn();
const mockPublicHolidayCreate = jest.fn();
const mockDisconnect = jest.fn();
const mockBcryptHash = jest.fn().mockResolvedValue("$2a$12$MOCKED_HASH");

// ── Mock PrismaClient before any import ─────────────────────────────────────

jest.mock("@prisma/client", () => {
  const UserRole = {
    EMPLOYEE: "EMPLOYEE",
    MANAGER: "MANAGER",
    HR: "HR",
    ADMIN: "ADMIN",
  };

  class PrismaClient {
    company = { upsert: mockCompanyUpsert };
    office = { upsert: mockOfficeUpsert };
    leaveTypeConfig = { upsert: mockLeaveTypeConfigUpsert };
    workflowConfig = { upsert: mockWorkflowConfigUpsert };
    workflowStep = { upsert: mockWorkflowStepUpsert };
    exceptionalLeaveRule = {
      findFirst: mockExceptionalLeaveRuleFindFirst,
      update: mockExceptionalLeaveRuleUpdate,
      create: mockExceptionalLeaveRuleCreate,
    };
    user = { upsert: mockUserUpsert };
    leaveBalance = { upsert: mockLeaveBalanceUpsert };
    publicHoliday = {
      upsert: mockPublicHolidayUpsert,
      findUnique: mockPublicHolidayFindUnique,
      update: mockPublicHolidayUpdate,
      create: mockPublicHolidayCreate,
    };
    $disconnect = mockDisconnect;
  }

  return { PrismaClient, UserRole };
});

jest.mock("bcryptjs", () => ({
  hash: mockBcryptHash,
}));

// Suppress console output during tests
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

// ── Helpers ─────────────────────────────────────────────────────────────────

function setupDefaultMocks() {
  const company = { id: "halley-tech-company", name: "Halley-Technologies SA" };
  const geneva = {
    id: "office-geneva",
    name: "Bureau de Genève",
    country: "CH",
    city: "Genève",
    defaultAnnualLeave: 25,
    defaultOfferedDays: 3,
    companyId: company.id,
  };
  const tunis = {
    id: "office-tunis",
    name: "Bureau de Tunis",
    country: "TN",
    city: "Tunis",
    defaultAnnualLeave: 25,
    defaultOfferedDays: 2,
    companyId: company.id,
  };
  const admin = {
    id: "admin-user-id",
    email: "hbo@halley-technologies.ch",
    firstName: "Haithem",
    lastName: "BOUAJILA",
  };

  mockCompanyUpsert.mockResolvedValue(company);
  mockOfficeUpsert
    .mockResolvedValueOnce(geneva)
    .mockResolvedValueOnce(tunis);
  mockLeaveTypeConfigUpsert.mockResolvedValue({});
  mockWorkflowConfigUpsert
    .mockResolvedValueOnce({ id: "wf-geneva" })
    .mockResolvedValueOnce({ id: "wf-tunis" });
  mockWorkflowStepUpsert.mockResolvedValue({});
  mockExceptionalLeaveRuleFindFirst.mockResolvedValue(null); // always "create" path
  mockExceptionalLeaveRuleCreate.mockResolvedValue({});
  mockUserUpsert.mockResolvedValue(admin);
  mockLeaveBalanceUpsert.mockResolvedValue({});
  mockPublicHolidayUpsert.mockResolvedValue({});
  mockPublicHolidayFindUnique.mockResolvedValue(null); // always "create" path for TN
  mockPublicHolidayCreate.mockResolvedValue({});
  mockDisconnect.mockResolvedValue(undefined);

  return { company, geneva, tunis, admin };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("prisma/seed.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset module registry so the seed file runs fresh each time
    jest.resetModules();
  });

  async function runSeed() {
    setupDefaultMocks();
    // Dynamic import triggers top-level main() call
    await jest.isolateModulesAsync(async () => {
      await import("../../../prisma/seed");
    });
    // Give the promise chain time to settle
    await new Promise((r) => setTimeout(r, 50));
  }

  // ── 1. Company ──────────────────────────────────────────────────────────

  describe("Company seeding", () => {
    it("should upsert the company with correct id and name", async () => {
      await runSeed();
      expect(mockCompanyUpsert).toHaveBeenCalledTimes(1);
      expect(mockCompanyUpsert).toHaveBeenCalledWith({
        where: { id: "halley-tech-company" },
        update: { name: "Halley-Technologies SA" },
        create: { id: "halley-tech-company", name: "Halley-Technologies SA" },
      });
    });
  });

  // ── 2. Offices ──────────────────────────────────────────────────────────

  describe("Office seeding", () => {
    it("should upsert two offices (Geneva and Tunis)", async () => {
      await runSeed();
      expect(mockOfficeUpsert).toHaveBeenCalledTimes(2);
    });

    it("should seed Geneva office with correct defaults", async () => {
      await runSeed();
      const genevaCall = mockOfficeUpsert.mock.calls[0][0];
      expect(genevaCall.where).toEqual({ id: "office-geneva" });
      expect(genevaCall.create).toMatchObject({
        id: "office-geneva",
        name: "Bureau de Genève",
        country: "CH",
        city: "Genève",
        defaultAnnualLeave: 25,
        defaultOfferedDays: 3,
        workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
      });
    });

    it("should seed Tunis office with correct defaults", async () => {
      await runSeed();
      const tunisCall = mockOfficeUpsert.mock.calls[1][0];
      expect(tunisCall.where).toEqual({ id: "office-tunis" });
      expect(tunisCall.create).toMatchObject({
        id: "office-tunis",
        name: "Bureau de Tunis",
        country: "TN",
        city: "Tunis",
        defaultAnnualLeave: 25,
        defaultOfferedDays: 2,
      });
    });
  });

  // ── 3. Leave Type Configs ───────────────────────────────────────────────

  describe("Leave type config seeding", () => {
    it("should create 8 leave types x 2 offices = 16 upserts", async () => {
      await runSeed();
      expect(mockLeaveTypeConfigUpsert).toHaveBeenCalledTimes(16);
    });

    it("should include ANNUAL leave type", async () => {
      await runSeed();
      const calls = mockLeaveTypeConfigUpsert.mock.calls.map((c: any) => c[0]);
      const annual = calls.find(
        (c: any) => c.where.officeId_code?.code === "ANNUAL" && c.where.officeId_code?.officeId === "office-geneva"
      );
      expect(annual).toBeDefined();
      expect(annual.create).toMatchObject({
        code: "ANNUAL",
        deductsFromBalance: true,
        balanceType: "ANNUAL",
      });
    });

    it("should include TELEWORK leave type", async () => {
      await runSeed();
      const calls = mockLeaveTypeConfigUpsert.mock.calls.map((c: any) => c[0]);
      const telework = calls.find(
        (c: any) => c.where.officeId_code?.code === "TELEWORK"
      );
      expect(telework).toBeDefined();
      expect(telework.create).toMatchObject({
        code: "TELEWORK",
        deductsFromBalance: false,
      });
    });

    it("should include SICK leave with attachment requirement", async () => {
      await runSeed();
      const calls = mockLeaveTypeConfigUpsert.mock.calls.map((c: any) => c[0]);
      const sick = calls.find(
        (c: any) => c.where.officeId_code?.code === "SICK"
      );
      expect(sick).toBeDefined();
      expect(sick.create).toMatchObject({
        code: "SICK",
        requiresAttachment: true,
        attachmentFromDay: 2,
        deductsFromBalance: false,
      });
    });

    it("should include all 8 expected leave type codes", async () => {
      await runSeed();
      const calls = mockLeaveTypeConfigUpsert.mock.calls.map((c: any) => c[0]);
      const codes = [...new Set(calls.map((c: any) => c.where.officeId_code?.code))];
      expect(codes).toEqual(
        expect.arrayContaining([
          "ANNUAL", "OFFERED", "SICK", "UNPAID",
          "MATERNITY", "PATERNITY", "EXCEPTIONAL", "TELEWORK",
        ])
      );
    });
  });

  // ── 4. Workflows ────────────────────────────────────────────────────────

  describe("Workflow seeding", () => {
    it("should create 2 workflow configs (Geneva + Tunis)", async () => {
      await runSeed();
      expect(mockWorkflowConfigUpsert).toHaveBeenCalledTimes(2);
    });

    it("should create Geneva workflow as SEQUENTIAL", async () => {
      await runSeed();
      const genevaWf = mockWorkflowConfigUpsert.mock.calls[0][0];
      expect(genevaWf.create).toMatchObject({
        id: "wf-geneva",
        mode: "SEQUENTIAL",
      });
    });

    it("should create 1 step for Geneva (MANAGER) and 2 for Tunis (MANAGER + HR)", async () => {
      await runSeed();
      // 3 total: Geneva has 1 step, Tunis has 2 steps
      expect(mockWorkflowStepUpsert).toHaveBeenCalledTimes(3);
    });

    it("should set Geneva workflow step as MANAGER at order 1", async () => {
      await runSeed();
      const genevaStep = mockWorkflowStepUpsert.mock.calls[0][0];
      expect(genevaStep.create).toMatchObject({
        workflowConfigId: "wf-geneva",
        stepOrder: 1,
        stepType: "MANAGER",
        isRequired: true,
      });
    });

    it("should set Tunis workflow step 2 as HR", async () => {
      await runSeed();
      const tunisStep2 = mockWorkflowStepUpsert.mock.calls[2][0];
      expect(tunisStep2.create).toMatchObject({
        workflowConfigId: "wf-tunis",
        stepOrder: 2,
        stepType: "HR",
        isRequired: true,
      });
    });
  });

  // ── 5. Exceptional Leave Rules ──────────────────────────────────────────

  describe("Exceptional leave rule seeding", () => {
    it("should create 4 rules x 2 offices = 8 rules when none exist", async () => {
      await runSeed();
      // findFirst returns null → create path for each
      expect(mockExceptionalLeaveRuleCreate).toHaveBeenCalledTimes(8);
    });

    it("should update existing rules instead of creating duplicates", async () => {
      setupDefaultMocks();
      // Override: pretend rules already exist
      mockExceptionalLeaveRuleFindFirst.mockResolvedValue({ id: "existing-rule" });
      mockExceptionalLeaveRuleUpdate.mockResolvedValue({});

      await jest.isolateModulesAsync(async () => {
        await import("../../../prisma/seed");
      });
      await new Promise((r) => setTimeout(r, 50));

      expect(mockExceptionalLeaveRuleUpdate).toHaveBeenCalledTimes(8);
      expect(mockExceptionalLeaveRuleCreate).not.toHaveBeenCalled();
    });

    it("should include Wedding rule with maxDays 3", async () => {
      await runSeed();
      const createCalls = mockExceptionalLeaveRuleCreate.mock.calls.map((c: any) => c[0]);
      const wedding = createCalls.find((c: any) => c.data?.reason_en === "Wedding" || c.reason_en === "Wedding");
      expect(wedding).toBeDefined();
    });

    it("should include all 4 exceptional leave reasons", async () => {
      await runSeed();
      const createCalls = mockExceptionalLeaveRuleCreate.mock.calls.map((c: any) => c[0]);
      const reasons = createCalls.map((c: any) => c.data?.reason_en || c.reason_en);
      expect(reasons).toEqual(
        expect.arrayContaining(["Wedding", "Bereavement", "Birth", "Moving"])
      );
    });
  });

  // ── 6. Admin User ───────────────────────────────────────────────────────

  describe("Admin user seeding", () => {
    it("should upsert admin user with correct email", async () => {
      await runSeed();
      expect(mockUserUpsert).toHaveBeenCalledTimes(1);
      const call = mockUserUpsert.mock.calls[0][0];
      expect(call.where).toEqual({ email: "hbo@halley-technologies.ch" });
    });

    it("should assign all 4 roles to admin", async () => {
      await runSeed();
      const call = mockUserUpsert.mock.calls[0][0];
      expect(call.create.roles).toEqual(["ADMIN", "HR", "MANAGER", "EMPLOYEE"]);
    });

    it("should assign admin to Geneva office", async () => {
      await runSeed();
      const call = mockUserUpsert.mock.calls[0][0];
      expect(call.create.officeId).toBe("office-geneva");
    });

    it("should set admin language to French", async () => {
      await runSeed();
      const call = mockUserUpsert.mock.calls[0][0];
      expect(call.create.language).toBe("fr");
    });

    it("should set admin name to Haithem BOUAJILA", async () => {
      await runSeed();
      const call = mockUserUpsert.mock.calls[0][0];
      expect(call.create.firstName).toBe("Haithem");
      expect(call.create.lastName).toBe("BOUAJILA");
    });

    it("should set hire date to 2024-01-01", async () => {
      await runSeed();
      const call = mockUserUpsert.mock.calls[0][0];
      expect(call.create.hireDate).toEqual(new Date("2024-01-01"));
    });

    it("should hash the password with bcrypt", async () => {
      await runSeed();
      expect(mockBcryptHash).toHaveBeenCalledWith("ChangeMe2026!", 12);
    });

    it("should store hashed password in create payload", async () => {
      await runSeed();
      const call = mockUserUpsert.mock.calls[0][0];
      expect(call.create.passwordHash).toBe("$2a$12$MOCKED_HASH");
    });

    it("should set password expiration to 90 days from now", async () => {
      await runSeed();
      const call = mockUserUpsert.mock.calls[0][0];
      const expiresAt = call.create.passwordExpiresAt;
      expect(expiresAt).toBeInstanceOf(Date);
      const now = new Date();
      const diffDays = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(89);
      expect(diffDays).toBeLessThanOrEqual(91);
    });

    it("should store password in passwordHistory", async () => {
      await runSeed();
      const call = mockUserUpsert.mock.calls[0][0];
      expect(call.create.passwordHistory).toEqual(["$2a$12$MOCKED_HASH"]);
    });
  });

  // ── 7. Leave Balances ───────────────────────────────────────────────────

  describe("Leave balance seeding", () => {
    it("should create 2 leave balances for admin (ANNUAL + OFFERED)", async () => {
      await runSeed();
      expect(mockLeaveBalanceUpsert).toHaveBeenCalledTimes(2);
    });

    it("should set ANNUAL balance to 25 days", async () => {
      await runSeed();
      const annualCall = mockLeaveBalanceUpsert.mock.calls[0][0];
      expect(annualCall.create).toMatchObject({
        year: 2026,
        balanceType: "ANNUAL",
        totalDays: 25,
        usedDays: 0,
        pendingDays: 0,
        carriedOverDays: 0,
      });
    });

    it("should set OFFERED balance to 3 days (Geneva default)", async () => {
      await runSeed();
      const offeredCall = mockLeaveBalanceUpsert.mock.calls[1][0];
      expect(offeredCall.create).toMatchObject({
        year: 2026,
        balanceType: "OFFERED",
        totalDays: 3,
        usedDays: 0,
      });
    });
  });

  // ── 8. Public Holidays ──────────────────────────────────────────────────

  describe("Public holiday seeding", () => {
    it("should upsert 10 Swiss (Geneva) holidays", async () => {
      await runSeed();
      expect(mockPublicHolidayUpsert).toHaveBeenCalledTimes(10);
    });

    it("should create Tunisian holidays (16 entries)", async () => {
      await runSeed();
      // TN holidays go through findUnique → create path (since findUnique returns null)
      expect(mockPublicHolidayCreate).toHaveBeenCalledTimes(16);
    });

    it("should update existing TN holiday instead of creating duplicate", async () => {
      setupDefaultMocks();
      // Override: pretend TN holidays already exist
      mockPublicHolidayFindUnique.mockResolvedValue({ id: "existing-holiday" });
      mockPublicHolidayUpdate.mockResolvedValue({});

      await jest.isolateModulesAsync(async () => {
        await import("../../../prisma/seed");
      });
      await new Promise((r) => setTimeout(r, 50));

      expect(mockPublicHolidayUpdate).toHaveBeenCalledTimes(16);
    });

    it("should include Swiss National Day (Aug 1)", async () => {
      await runSeed();
      const calls = mockPublicHolidayUpsert.mock.calls.map((c: any) => c[0]);
      const nationalDay = calls.find((c: any) => c.create?.name_en === "Swiss National Day");
      expect(nationalDay).toBeDefined();
      expect(nationalDay.create.type).toBe("NATIONAL");
    });

    it("should include Christmas for Geneva", async () => {
      await runSeed();
      const calls = mockPublicHolidayUpsert.mock.calls.map((c: any) => c[0]);
      const christmas = calls.find((c: any) => c.create?.name_en === "Christmas Day");
      expect(christmas).toBeDefined();
      expect(christmas.create.type).toBe("RELIGIOUS");
    });
  });

  // ── 9. Cleanup ──────────────────────────────────────────────────────────

  describe("Cleanup", () => {
    it("should disconnect Prisma client after completion", async () => {
      await runSeed();
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });
});
