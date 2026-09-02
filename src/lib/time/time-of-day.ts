/**
 * Departure and arrival times (SRS 31.3).
 *
 * These are wall-clock readings a driver wrote down, not instants. "Departed
 * at 07:45" means 07:45 wherever the driver was; it is not a point on the UTC
 * timeline and must never be shifted by a timezone conversion.
 *
 * PostgreSQL models this exactly with `time`, which is what the schema uses.
 * The awkward part is JavaScript, which has no time-only type, so Prisma
 * surfaces a `time` column as a `Date` pinned to 1970-01-01. Left unmanaged
 * that is a reliable source of off-by-one-hour bugs, because every `Date`
 * accessor except the UTC ones applies the server's local offset.
 *
 * This module is the boundary. Everything above the repository layer works
 * with `"HH:MM"` strings; only the mappers here ever touch the `Date`
 * representation, and they use UTC accessors exclusively.
 */

/** Matches a 24-hour `HH:MM` string. Rejects `24:00` and single-digit hours. */
export const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * A validated `"HH:MM"` string.
 *
 * The brand is what stops a raw `string` being passed to `timeOfDayToDate`
 * without going through validation first - the compiler rejects it, so the
 * mapper never has to re-check at runtime.
 */
export type TimeOfDay = string & { readonly __brand: 'TimeOfDay' };

export function isTimeOfDay(value: string): value is TimeOfDay {
  return TIME_OF_DAY_PATTERN.test(value);
}

/**
 * Narrows a string to `TimeOfDay`, throwing on anything malformed.
 *
 * Intended for trusted internal callers such as the seed script. Request
 * payloads go through `timeOfDaySchema` instead, which reports the failure as
 * a field error rather than an exception.
 */
export function asTimeOfDay(value: string): TimeOfDay {
  if (!isTimeOfDay(value)) {
    throw new Error(`Expected a HH:MM time of day, received "${value}".`);
  }
  return value;
}

/**
 * Converts `"HH:MM"` into the `Date` Prisma writes to a `time` column.
 *
 * The date part is fixed at the Unix epoch and the components are set in UTC,
 * so the value the driver typed is the value PostgreSQL stores regardless of
 * the server's own timezone.
 */
export function timeOfDayToDate(value: TimeOfDay): Date {
  // The brand guarantees the pattern matched, so both parts are present; the
  // fallbacks satisfy `noUncheckedIndexedAccess` without a non-null assertion.
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));
}

/**
 * Converts the `Date` Prisma reads from a `time` column back to `"HH:MM"`.
 *
 * Uses UTC accessors to mirror {@link timeOfDayToDate}. Using `getHours()`
 * here instead would shift every stored time by the server's offset, which is
 * the exact bug this module exists to prevent.
 */
export function dateToTimeOfDay(value: Date): TimeOfDay {
  const hours = String(value.getUTCHours()).padStart(2, '0');
  const minutes = String(value.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}` as TimeOfDay;
}

/**
 * Minutes since midnight.
 *
 * Useful for ordering and for future duration reporting (SRS 28.6). V1 does
 * not compare departure against arrival - an overnight service legitimately
 * arrives at an earlier clock time, and SRS 31.3 rules out overnight logic
 * for now - so nothing in V1 should use this to validate ordering.
 */
export function timeOfDayToMinutes(value: TimeOfDay): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
