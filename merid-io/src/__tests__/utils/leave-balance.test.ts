import {
  computeProrata,
  computeRemainingBalance,
} from "@/lib/leave-balance";

describe("computeProrata", () => {
  const ANNUAL_DAYS = 25;

  it("should return full allocation if hired before reference year", () => {
    const hireDate = new Date("2024-06-15");
    const refDate = new Date("2026-12-31");
    expect(computeProrata(hireDate, refDate, ANNUAL_DAYS)).toBe(25);
  });

  it("should return 0 if hired after the reference year", () => {
    const hireDate = new Date("2027-03-01");
    const refDate = new Date("2026-12-31");
    expect(computeProrata(hireDate, refDate, ANNUAL_DAYS)).toBe(0);
  });

  it("should return ~50% for mid-year hire (July 1)", () => {
    // Hired July (month 6, 0-indexed) → 6 months remaining → 25/12*6 = 12.5
    const hireDate = new Date("2026-07-01");
    const refDate = new Date("2026-12-31");
    expect(computeProrata(hireDate, refDate, ANNUAL_DAYS)).toBe(12.5);
  });

  it("should return full allocation for January 1 hire", () => {
    // Hired Jan (month 0) → 12 months remaining → 25
    const hireDate = new Date("2026-01-01");
    const refDate = new Date("2026-12-31");
    expect(computeProrata(hireDate, refDate, ANNUAL_DAYS)).toBe(25);
  });

  it("should return ~8.3% for December 1 hire", () => {
    // Hired Dec (month 11) → 1 month remaining → 25/12*1 ≈ 2.1
    const hireDate = new Date("2026-12-01");
    const refDate = new Date("2026-12-31");
    expect(computeProrata(hireDate, refDate, ANNUAL_DAYS)).toBe(2.1);
  });

  it("should return ~75% for April hire", () => {
    // Hired April (month 3) → 9 months remaining → 25/12*9 = 18.75 → 18.8
    const hireDate = new Date("2026-04-01");
    const refDate = new Date("2026-12-31");
    expect(computeProrata(hireDate, refDate, ANNUAL_DAYS)).toBe(18.8);
  });

  it("should handle non-standard annual allocations", () => {
    // 30 annual days, hired mid-year
    const hireDate = new Date("2026-07-01");
    const refDate = new Date("2026-12-31");
    expect(computeProrata(hireDate, refDate, 30)).toBe(15);
  });

  it("should handle same year hire and reference with offered days", () => {
    // 3 offered days, hired October (month 9) → 3 months → 3/12*3 = 0.75 → 0.8
    const hireDate = new Date("2026-10-01");
    const refDate = new Date("2026-12-31");
    expect(computeProrata(hireDate, refDate, 3)).toBe(0.8);
  });
});

describe("computeRemainingBalance", () => {
  it("should compute remaining balance correctly", () => {
    expect(computeRemainingBalance(25, 0, 10, 3)).toBe(12);
  });

  it("should include carried over days", () => {
    expect(computeRemainingBalance(25, 5, 10, 3)).toBe(17);
  });

  it("should return 0 when fully used", () => {
    expect(computeRemainingBalance(25, 0, 25, 0)).toBe(0);
  });

  it("should return negative when overdrawn", () => {
    expect(computeRemainingBalance(25, 0, 26, 0)).toBe(-1);
  });

  it("should handle pending days correctly", () => {
    // 25 total + 5 carry - 15 used - 10 pending = 5
    expect(computeRemainingBalance(25, 5, 15, 10)).toBe(5);
  });
});
