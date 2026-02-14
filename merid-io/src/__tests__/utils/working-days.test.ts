import {
  calculateWorkingDays,
  buildWorkingDaySet,
  buildHolidaySet,
  DAY_MAP,
} from "@/lib/working-days";

// Standard Mon-Fri working days
const MON_FRI = buildWorkingDaySet(["MON", "TUE", "WED", "THU", "FRI"]);
const NO_HOLIDAYS = new Set<string>();

describe("calculateWorkingDays", () => {
  // ─── Basic weekday counting ───────────────────────────────────

  it("should count 5 working days for a full Mon-Fri week", () => {
    // 2026-01-05 (Mon) to 2026-01-09 (Fri)
    const result = calculateWorkingDays(
      new Date("2026-01-05"),
      new Date("2026-01-09"),
      "FULL_DAY",
      "FULL_DAY",
      MON_FRI,
      NO_HOLIDAYS
    );
    expect(result).toBe(5);
  });

  it("should count 1 day for a single working day", () => {
    // 2026-01-05 (Monday)
    const result = calculateWorkingDays(
      new Date("2026-01-05"),
      new Date("2026-01-05"),
      "FULL_DAY",
      "FULL_DAY",
      MON_FRI,
      NO_HOLIDAYS
    );
    expect(result).toBe(1);
  });

  it("should count 0 days for a weekend-only range", () => {
    // 2026-01-03 (Sat) to 2026-01-04 (Sun)
    const result = calculateWorkingDays(
      new Date("2026-01-03"),
      new Date("2026-01-04"),
      "FULL_DAY",
      "FULL_DAY",
      MON_FRI,
      NO_HOLIDAYS
    );
    expect(result).toBe(0);
  });

  it("should count 10 working days for a 2-week span", () => {
    // 2026-01-05 (Mon) to 2026-01-16 (Fri)
    const result = calculateWorkingDays(
      new Date("2026-01-05"),
      new Date("2026-01-16"),
      "FULL_DAY",
      "FULL_DAY",
      MON_FRI,
      NO_HOLIDAYS
    );
    expect(result).toBe(10);
  });

  // ─── Half-day support ─────────────────────────────────────────

  it("should count 0.5 for a single day with startHalfDay MORNING", () => {
    const result = calculateWorkingDays(
      new Date("2026-01-05"),
      new Date("2026-01-05"),
      "MORNING",
      "FULL_DAY",
      MON_FRI,
      NO_HOLIDAYS
    );
    expect(result).toBe(0.5);
  });

  it("should count 0.5 for a single day with startHalfDay AFTERNOON", () => {
    const result = calculateWorkingDays(
      new Date("2026-01-05"),
      new Date("2026-01-05"),
      "AFTERNOON",
      "FULL_DAY",
      MON_FRI,
      NO_HOLIDAYS
    );
    expect(result).toBe(0.5);
  });

  it("should count 4.5 for Mon-Fri with start AFTERNOON", () => {
    // Start afternoon Monday, full day Tue-Fri = 0.5 + 4 = 4.5
    const result = calculateWorkingDays(
      new Date("2026-01-05"),
      new Date("2026-01-09"),
      "AFTERNOON",
      "FULL_DAY",
      MON_FRI,
      NO_HOLIDAYS
    );
    expect(result).toBe(4.5);
  });

  it("should count 4.5 for Mon-Fri with end MORNING", () => {
    // Full Mon-Thu + morning Friday = 4 + 0.5 = 4.5
    const result = calculateWorkingDays(
      new Date("2026-01-05"),
      new Date("2026-01-09"),
      "FULL_DAY",
      "MORNING",
      MON_FRI,
      NO_HOLIDAYS
    );
    expect(result).toBe(4.5);
  });

  it("should count 4 for Mon-Fri with start AFTERNOON + end MORNING", () => {
    // 0.5 + 3 + 0.5 = 4
    const result = calculateWorkingDays(
      new Date("2026-01-05"),
      new Date("2026-01-09"),
      "AFTERNOON",
      "MORNING",
      MON_FRI,
      NO_HOLIDAYS
    );
    expect(result).toBe(4);
  });

  // ─── Holiday exclusion ────────────────────────────────────────

  it("should exclude holidays from the count", () => {
    // 2026-01-05 (Mon) to 2026-01-09 (Fri) with Wed 07 as holiday
    const holidays = new Set(["2026-01-07"]);
    const result = calculateWorkingDays(
      new Date("2026-01-05"),
      new Date("2026-01-09"),
      "FULL_DAY",
      "FULL_DAY",
      MON_FRI,
      holidays
    );
    expect(result).toBe(4);
  });

  it("should exclude multiple holidays", () => {
    // Mon-Fri with 2 holidays
    const holidays = new Set(["2026-01-06", "2026-01-08"]);
    const result = calculateWorkingDays(
      new Date("2026-01-05"),
      new Date("2026-01-09"),
      "FULL_DAY",
      "FULL_DAY",
      MON_FRI,
      holidays
    );
    expect(result).toBe(3);
  });

  it("should not count a holiday on a weekend (no double exclusion)", () => {
    // Holiday on Saturday should not affect count
    const holidays = new Set(["2026-01-03"]); // Saturday
    const result = calculateWorkingDays(
      new Date("2026-01-05"),
      new Date("2026-01-09"),
      "FULL_DAY",
      "FULL_DAY",
      MON_FRI,
      holidays
    );
    expect(result).toBe(5);
  });

  it("should handle Swiss holidays in January 2026", () => {
    // 2026-01-01 (Thu) = Jour de l'An, holiday
    // 2025-12-29 (Mon) to 2026-01-02 (Fri) → Mon,Tue,Wed = 3 working days (Thu=holiday, Fri=working)
    // Actually let's test Jan 2026 week 1
    // Jan 1 Thu is holiday, Jan 2 Fri is working
    const chHolidays = new Set(["2026-01-01"]);
    const result = calculateWorkingDays(
      new Date("2026-01-01"),
      new Date("2026-01-02"),
      "FULL_DAY",
      "FULL_DAY",
      MON_FRI,
      chHolidays
    );
    // Jan 1 = Thu holiday (excluded), Jan 2 = Fri (working) = 1
    expect(result).toBe(1);
  });

  // ─── Custom working days ──────────────────────────────────────

  it("should support Sun-Thu working week (Middle East)", () => {
    const sunThu = buildWorkingDaySet(["SUN", "MON", "TUE", "WED", "THU"]);
    // 2026-01-04 (Sun) to 2026-01-10 (Sat) = Sun,Mon,Tue,Wed,Thu = 5
    const result = calculateWorkingDays(
      new Date("2026-01-04"),
      new Date("2026-01-10"),
      "FULL_DAY",
      "FULL_DAY",
      sunThu,
      NO_HOLIDAYS
    );
    expect(result).toBe(5);
  });
});

describe("buildWorkingDaySet", () => {
  it("should map standard Mon-Fri to day numbers", () => {
    const set = buildWorkingDaySet(["MON", "TUE", "WED", "THU", "FRI"]);
    expect(set.has(1)).toBe(true); // MON
    expect(set.has(5)).toBe(true); // FRI
    expect(set.has(0)).toBe(false); // SUN
    expect(set.has(6)).toBe(false); // SAT
  });

  it("should handle unknown day codes gracefully", () => {
    const set = buildWorkingDaySet(["MON", "INVALID"]);
    expect(set.has(1)).toBe(true);
    expect(set.has(-1)).toBe(true); // unknown maps to -1
  });
});

describe("buildHolidaySet", () => {
  it("should format dates as YYYY-MM-DD strings", () => {
    const dates = [new Date("2026-01-01"), new Date("2026-12-25")];
    const set = buildHolidaySet(dates);
    expect(set.has("2026-01-01")).toBe(true);
    expect(set.has("2026-12-25")).toBe(true);
    expect(set.size).toBe(2);
  });
});

describe("DAY_MAP", () => {
  it("should have correct mappings for all days", () => {
    expect(DAY_MAP.SUN).toBe(0);
    expect(DAY_MAP.MON).toBe(1);
    expect(DAY_MAP.TUE).toBe(2);
    expect(DAY_MAP.WED).toBe(3);
    expect(DAY_MAP.THU).toBe(4);
    expect(DAY_MAP.FRI).toBe(5);
    expect(DAY_MAP.SAT).toBe(6);
  });
});
