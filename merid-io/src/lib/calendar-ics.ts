/**
 * ICS (iCalendar) file generator for leave events.
 *
 * Generates RFC 5545 compliant .ics content that can be attached to emails.
 * Supported by Outlook, Google Calendar, Apple Calendar, Thunderbird, etc.
 */

/**
 * Format a Date to ICS DATE format: YYYYMMDD
 */
function formatICSDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * Format a Date to ICS DATETIME format: YYYYMMDDTHHMMSSZ
 */
function formatICSDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

interface LeaveICSParams {
  leaveRequestId: string;
  startDate: string; // ISO date string or "DD/MM/YYYY"
  endDate: string;
  userName: string;
  leaveType: string;
}

/**
 * Parse a date string that could be ISO format or DD/MM/YYYY.
 */
function parseDate(dateStr: string): Date {
  // Try DD/MM/YYYY format
  const ddmmyyyy = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    return new Date(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]) - 1, Number(ddmmyyyy[1]));
  }
  return new Date(dateStr);
}

/**
 * Generate an ICS calendar file content for a leave event.
 *
 * Creates an all-day event spanning the leave period.
 * DTEND is exclusive in iCalendar spec, so we add 1 day.
 */
export function generateLeaveICS(params: LeaveICSParams): string {
  const start = parseDate(params.startDate);
  const end = parseDate(params.endDate);

  // DTEND is exclusive for VALUE=DATE, so add 1 day
  const endExclusive = new Date(end);
  endExclusive.setDate(endExclusive.getDate() + 1);

  const now = new Date();
  const uid = `leave-${params.leaveRequestId}@meridio.app`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Meridio//Conges//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatICSDateTime(now)}`,
    `DTSTART;VALUE=DATE:${formatICSDate(start)}`,
    `DTEND;VALUE=DATE:${formatICSDate(endExclusive)}`,
    `SUMMARY:${escapeICSText(`${params.leaveType} - ${params.userName}`)}`,
    `DESCRIPTION:${escapeICSText(`Absence approuvee : ${params.leaveType} du ${params.startDate} au ${params.endDate}`)}`,
    "TRANSP:OPAQUE",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

/**
 * Escape special characters for ICS text fields (RFC 5545 section 3.3.11).
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
