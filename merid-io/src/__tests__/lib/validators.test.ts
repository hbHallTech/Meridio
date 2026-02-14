import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verify2FASchema,
  leaveRequestSchema,
  userSchema,
  approvalSchema,
  PASSWORD_REGEX,
} from "@/lib/validators";

describe("PASSWORD_REGEX", () => {
  it("should accept valid password", () => {
    expect(PASSWORD_REGEX.test("MyP@ss1234")).toBe(true);
  });

  it("should reject password without uppercase", () => {
    expect(PASSWORD_REGEX.test("myp@ss1234")).toBe(false);
  });

  it("should reject password without lowercase", () => {
    expect(PASSWORD_REGEX.test("MYP@SS1234")).toBe(false);
  });

  it("should reject password without digit", () => {
    expect(PASSWORD_REGEX.test("MyP@ssword")).toBe(false);
  });

  it("should reject password without special char", () => {
    expect(PASSWORD_REGEX.test("MyPass1234")).toBe(false);
  });

  it("should reject password shorter than 8 chars", () => {
    expect(PASSWORD_REGEX.test("Pa1!")).toBe(false);
  });
});

describe("loginSchema", () => {
  it("should validate correct login input", () => {
    const result = loginSchema.safeParse({
      email: "user@halley-technologies.ch",
      password: "test",
    });
    expect(result.success).toBe(true);
  });

  it("should reject non-halley-technologies email", () => {
    const result = loginSchema.safeParse({
      email: "user@gmail.com",
      password: "test",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "test",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@halley-technologies.ch",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("should validate halley-technologies email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "admin@halley-technologies.ch",
    });
    expect(result.success).toBe(true);
  });

  it("should reject external email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "admin@example.com",
    });
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("should validate matching passwords with token", () => {
    const result = resetPasswordSchema.safeParse({
      token: "some-token-123",
      password: "NewPass1!",
      confirmPassword: "NewPass1!",
    });
    expect(result.success).toBe(true);
  });

  it("should reject mismatched passwords", () => {
    const result = resetPasswordSchema.safeParse({
      token: "some-token-123",
      password: "NewPass1!",
      confirmPassword: "DifferentPass1!",
    });
    expect(result.success).toBe(false);
  });

  it("should reject weak password", () => {
    const result = resetPasswordSchema.safeParse({
      token: "some-token-123",
      password: "weak",
      confirmPassword: "weak",
    });
    expect(result.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("should validate correct change password input", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "oldpass",
      newPassword: "NewStr0ng!",
      confirmPassword: "NewStr0ng!",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty current password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "",
      newPassword: "NewStr0ng!",
      confirmPassword: "NewStr0ng!",
    });
    expect(result.success).toBe(false);
  });
});

describe("verify2FASchema", () => {
  it("should accept 6-digit code", () => {
    const result = verify2FASchema.safeParse({ code: "123456" });
    expect(result.success).toBe(true);
  });

  it("should reject non-numeric code", () => {
    const result = verify2FASchema.safeParse({ code: "abcdef" });
    expect(result.success).toBe(false);
  });

  it("should reject short code", () => {
    const result = verify2FASchema.safeParse({ code: "12345" });
    expect(result.success).toBe(false);
  });

  it("should reject code longer than 6 digits", () => {
    const result = verify2FASchema.safeParse({ code: "1234567" });
    expect(result.success).toBe(false);
  });
});

describe("leaveRequestSchema", () => {
  const validRequest = {
    leaveTypeConfigId: "lt-123",
    startDate: "2026-06-01",
    endDate: "2026-06-05",
    startHalfDay: "FULL_DAY" as const,
    endHalfDay: "FULL_DAY" as const,
  };

  it("should validate a correct leave request", () => {
    const result = leaveRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it("should accept optional reason", () => {
    const result = leaveRequestSchema.safeParse({
      ...validRequest,
      reason: "Vacances",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing leave type", () => {
    const result = leaveRequestSchema.safeParse({
      ...validRequest,
      leaveTypeConfigId: "",
    });
    expect(result.success).toBe(false);
  });

  it("should accept MORNING half day", () => {
    const result = leaveRequestSchema.safeParse({
      ...validRequest,
      startHalfDay: "MORNING",
    });
    expect(result.success).toBe(true);
  });

  it("should accept AFTERNOON half day", () => {
    const result = leaveRequestSchema.safeParse({
      ...validRequest,
      endHalfDay: "AFTERNOON",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid half day value", () => {
    const result = leaveRequestSchema.safeParse({
      ...validRequest,
      startHalfDay: "EVENING",
    });
    expect(result.success).toBe(false);
  });
});

describe("userSchema", () => {
  const validUser = {
    firstName: "John",
    lastName: "Doe",
    email: "john@halley-technologies.ch",
    roles: ["EMPLOYEE"],
    officeId: "office-1",
    hireDate: "2026-01-15",
  };

  it("should validate correct user input", () => {
    const result = userSchema.safeParse(validUser);
    expect(result.success).toBe(true);
  });

  it("should accept multiple roles", () => {
    const result = userSchema.safeParse({
      ...validUser,
      roles: ["EMPLOYEE", "MANAGER"],
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty roles array", () => {
    const result = userSchema.safeParse({
      ...validUser,
      roles: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing firstName", () => {
    const result = userSchema.safeParse({
      ...validUser,
      firstName: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("approvalSchema", () => {
  it("should validate APPROVED action", () => {
    const result = approvalSchema.safeParse({ action: "APPROVED" });
    expect(result.success).toBe(true);
  });

  it("should validate REFUSED action with comment", () => {
    const result = approvalSchema.safeParse({
      action: "REFUSED",
      comment: "Not enough notice",
    });
    expect(result.success).toBe(true);
  });

  it("should validate RETURNED action", () => {
    const result = approvalSchema.safeParse({ action: "RETURNED" });
    expect(result.success).toBe(true);
  });

  it("should reject invalid action", () => {
    const result = approvalSchema.safeParse({ action: "PENDING" });
    expect(result.success).toBe(false);
  });
});
