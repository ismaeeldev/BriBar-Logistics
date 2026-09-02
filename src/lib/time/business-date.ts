/**
 * Business dates and timestamp rendering (SRS 31.3).
 *
 * Two different things are called "date" in this application and conflating
 * them causes records to land on the wrong day:
 *
 *   * An **instant** - `created_at`, `approved_at`. Stored as `timestamptz` in
 *     UTC, rendered in `APP_TIMEZONE`.
 *   * A **business date** - `service_date`. A calendar day with no time and no
 *     zone, stored as `date`.
 *
 * A service submitted at 00:30 Lisbon time is 23:30 UTC on the *previous* day.
 * Taking `new Date().toISOString().slice(0, 10)` would file it under
 * yesterday. Every function here takes the timezone explicitly so that the
 * conversion is always deliberate and always unit-testable; callers pass
 * `env.APP_TIMEZONE`.
 */
import { formatInTimeZone } from 'date-fns-tz';

/**
 * The calendar day `instant` falls on in `timeZone`, as a `Date` whose UTC
 * midnight matches that day.
 *
 * UTC midnight is the representation Prisma expects for a `@db.Date` column:
 * it is what PostgreSQL returns for one, so a value written this way survives
 * a round trip unchanged.
 */
export function businessDateFor(instant: Date, timeZone: string): Date {
  const isoDay = formatInTimeZone(instant, timeZone, 'yyyy-MM-dd');
  return new Date(`${isoDay}T00:00:00.000Z`);
}

/** Today in `timeZone`. Auto-populated onto every new service (SRS 9.2). */
export function currentBusinessDate(timeZone: string): Date {
  return businessDateFor(new Date(), timeZone);
}

/** The `yyyy-MM-dd` form, for URLs, filters and the Service ID. */
export function toIsoDate(businessDate: Date): string {
  return businessDate.toISOString().slice(0, 10);
}

/**
 * Parses a `yyyy-MM-dd` filter value into a business date.
 *
 * Returns `null` rather than throwing, so a malformed query string becomes a
 * field error at the schema boundary instead of a 500.
 */
export function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  // Rejects real-looking but invalid days such as 2026-02-30, which the Date
  // constructor silently rolls forward into March.
  return toIsoDate(parsed) === value ? parsed : null;
}

/**
 * Renders a business date for display.
 *
 * Formatted in UTC on purpose: a `@db.Date` carries no time, so converting it
 * into a zone behind UTC would move it to the previous day.
 */
export function formatBusinessDate(businessDate: Date): string {
  return formatInTimeZone(businessDate, 'UTC', 'dd/MM/yyyy');
}

/** Renders an audit instant in the configured business timezone. */
export function formatBusinessDateTime(instant: Date, timeZone: string): string {
  return formatInTimeZone(instant, timeZone, 'dd/MM/yyyy HH:mm');
}

/**
 * The half-open UTC interval covering `[from, to]` inclusive in business-date
 * terms, for the admin date-range filter (SRS 16.3).
 *
 * Half-open (`gte` / `lt`) rather than `between`, so the upper bound cannot
 * accidentally exclude records on the final day.
 */
export function businessDateRange(
  from: Date | null,
  to: Date | null,
): { gte?: Date; lt?: Date } {
  const range: { gte?: Date; lt?: Date } = {};

  if (from) range.gte = from;
  if (to) {
    const exclusiveEnd = new Date(to);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    range.lt = exclusiveEnd;
  }

  return range;
}
