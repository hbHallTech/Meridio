/**
 * Leave balance computation utilities.
 */

/**
 * Compute prorated leave days based on hire date.
 *
 * If an employee starts mid-year, they get a fraction of the annual allocation
 * proportional to the remaining months in the year.
 *
 * @param hireDate - The employee's hire date
 * @param referenceDate - The date to compute prorata against (typically end of year or today)
 * @param annualDays - Full annual leave allocation (e.g. 25)
 * @returns Prorated number of days (rounded to 1 decimal)
 */
export function computeProrata(
  hireDate: Date,
  referenceDate: Date,
  annualDays: number
): number {
  const hireYear = hireDate.getFullYear();
  const refYear = referenceDate.getFullYear();

  // If hired before the reference year, full allocation
  if (hireYear < refYear) {
    return annualDays;
  }

  // If hired after the reference year, no allocation
  if (hireYear > refYear) {
    return 0;
  }

  // Hired in the same year as reference: prorate based on remaining months
  const hireMonth = hireDate.getMonth(); // 0-indexed (Jan = 0)
  const remainingMonths = 12 - hireMonth;
  const prorated = (annualDays / 12) * remainingMonths;

  return Math.round(prorated * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate remaining balance for a leave type.
 */
export function computeRemainingBalance(
  totalDays: number,
  carriedOverDays: number,
  usedDays: number,
  pendingDays: number
): number {
  return totalDays + carriedOverDays - usedDays - pendingDays;
}
