import { z } from "zod";

/**
 * Zod schema for optional date query parameters.
 * Accepts ISO datetime (2026-02-01T00:00:00.000Z) or date-only (2026-02-01).
 */
const isoDateString = z
  .string()
  .refine(
    (val) => {
      const d = new Date(val);
      return !isNaN(d.getTime());
    },
    { message: "Date invalide" }
  );

export const dateRangeQuerySchema = z.object({
  from: isoDateString.optional(),
  to: isoDateString.optional(),
});

export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;

/**
 * Parse a "from" (start) date query param into a valid Date.
 * Returns the Date as-is (beginning of range).
 */
export function parseFromDate(value: string): Date {
  return new Date(value);
}

/**
 * Parse a "to" (end) date query param into a valid Date.
 * For date-only strings (YYYY-MM-DD), sets time to 23:59:59.999 UTC
 * to include the full day. For ISO datetime strings, uses as-is since
 * callers like FullCalendar already send the correct boundary.
 */
export function parseToDate(value: string): Date {
  if (!value.includes("T")) {
    return new Date(`${value}T23:59:59.999Z`);
  }
  return new Date(value);
}

/** Maximum allowed date range in days (prevents abuse / heavy queries) */
const MAX_RANGE_DAYS = 366;

/**
 * Validate and parse date range query params from URLSearchParams.
 * Returns { from, to } as Date | null, or an error string if invalid.
 *
 * Enforces:
 *  - Zod validation on input strings
 *  - Max range of 366 days when both from and to are provided
 *  - from must be before to
 *
 * Usage in route handlers:
 *   const result = parseDateRangeParams(searchParams, "manager/calendar");
 *   if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
 *   const { from, to } = result;
 */
export function parseDateRangeParams(
  searchParams: URLSearchParams,
  routeLabel: string
): { from: Date | null; to: Date | null; error?: never } | { from?: never; to?: never; error: string } {
  const fromRaw = searchParams.get("from") || undefined;
  const toRaw = searchParams.get("to") || undefined;

  // If neither param is provided, no filtering needed
  if (!fromRaw && !toRaw) {
    return { from: null, to: null };
  }

  const parsed = dateRangeQuerySchema.safeParse({ from: fromRaw, to: toRaw });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    console.error(`[${routeLabel}] Invalid date params rejected: from="${fromRaw}" to="${toRaw}" — ${issues}`);
    return { error: `Paramètres de date invalides: ${issues}` };
  }

  const from = parsed.data.from ? parseFromDate(parsed.data.from) : null;
  const to = parsed.data.to ? parseToDate(parsed.data.to) : null;

  // Enforce max range to prevent heavy queries
  if (from && to) {
    const diffMs = to.getTime() - from.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays > MAX_RANGE_DAYS) {
      console.warn(`[${routeLabel}] Date range too large: ${diffDays.toFixed(0)} days (max ${MAX_RANGE_DAYS})`);
      return { error: `Période trop longue (max ${MAX_RANGE_DAYS} jours)` };
    }
    if (diffDays < 0) {
      console.warn(`[${routeLabel}] Inverted date range: from=${from.toISOString()} to=${to.toISOString()}`);
      return { error: "La date de début doit être avant la date de fin" };
    }
  }

  console.log(`[${routeLabel}] Date range: from=${from?.toISOString() ?? "none"} to=${to?.toISOString() ?? "none"}`);

  return { from, to };
}
