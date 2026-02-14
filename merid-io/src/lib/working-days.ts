/**
 * Working days calculation utilities.
 * Extracted from API routes for testability and reuse.
 */

export const DAY_MAP: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

/**
 * Calculate the number of working days between two dates,
 * excluding weekends (based on office working days) and public holidays.
 */
export function calculateWorkingDays(
  start: Date,
  end: Date,
  startHalfDay: string,
  endHalfDay: string,
  workingDayNumbers: Set<number>,
  holidaySet: Set<string>
): number {
  let totalDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split("T")[0];

    if (workingDayNumbers.has(dayOfWeek) && !holidaySet.has(dateStr)) {
      if (
        current.getTime() === start.getTime() &&
        current.getTime() === end.getTime()
      ) {
        // Same day
        if (startHalfDay === "MORNING" || startHalfDay === "AFTERNOON") {
          totalDays += 0.5;
        } else if (endHalfDay === "MORNING" || endHalfDay === "AFTERNOON") {
          totalDays += 0.5;
        } else {
          totalDays += 1;
        }
      } else if (current.getTime() === start.getTime()) {
        totalDays += startHalfDay === "AFTERNOON" ? 0.5 : 1;
      } else if (current.getTime() === end.getTime()) {
        totalDays += endHalfDay === "MORNING" ? 0.5 : 1;
      } else {
        totalDays += 1;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return totalDays;
}

/**
 * Build a Set of working day numbers from office config strings.
 * e.g., ["MON", "TUE", "WED", "THU", "FRI"] → Set(1, 2, 3, 4, 5)
 */
export function buildWorkingDaySet(workingDays: string[]): Set<number> {
  return new Set(workingDays.map((d) => DAY_MAP[d] ?? -1));
}

/**
 * Build a Set of holiday date strings ("YYYY-MM-DD") from Date objects.
 */
export function buildHolidaySet(holidays: Date[]): Set<string> {
  return new Set(holidays.map((h) => h.toISOString().split("T")[0]));
}
