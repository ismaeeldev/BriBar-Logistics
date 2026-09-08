/**
 * Departure and arrival ordering (SRS 9.3, 31.3 + client decisions #3 and the
 * 2026-09-09 change request).
 *
 * ## History
 *
 * SRS 31.3 declined overnight logic for V1. Client decision #3 then asked for
 * one rule: a service whose arrival is earlier than its departure *on the same
 * day* is a transposition typo and must be rejected. To keep genuine overnight
 * runs recordable, the service carries an `endsNextDay` flag.
 *
 * Decision #3 also added a second rule — a flagged-overnight service was
 * required to arrive *before* it departed, so it could not silently span 24
 * hours or more. The 2026-09-09 change request removed that second rule: when
 * the driver ticks "llega al día siguiente" the arrival time is accepted as
 * entered, full stop. Rejecting a plausible clock time there confused drivers
 * and, in some paths, surfaced as an error rather than a field message.
 *
 * ## The rule, now
 *
 *   endsNextDay = false   arrival must be strictly after departure
 *   endsNextDay = true    any valid arrival time is accepted
 *
 * A next-day service can therefore be recorded as spanning more than 24 hours.
 * That is a deliberate trade: the client would rather accept an unusual entry
 * than block a real one.
 *
 * Pure: no framework, no database, no message catalogue. Violations are codes;
 * the Spanish wording lives in `src/lib/i18n/messages.ts`.
 */
import { timeOfDayToMinutes, type TimeOfDay } from '@/lib/time/time-of-day';

const MINUTES_PER_DAY = 24 * 60;

export interface ServiceTimes {
  departureTime: TimeOfDay;
  arrivalTime: TimeOfDay;
  /** SRS 31.3. False for the overwhelming majority of services. */
  endsNextDay: boolean;
}

export type ServiceTimeViolationCode =
  /** Same-day service whose arrival is at or before its departure. */
  'ARRIVAL_NOT_AFTER_DEPARTURE';

export interface ServiceTimeViolation {
  code: ServiceTimeViolationCode;
  field: 'arrivalTime';
}

/**
 * How long the service ran, in minutes.
 *
 * For a same-day service this is in `(0, 1440)`. For a next-day service it is
 * `> 0` but no longer bounded above by a day — see the module note.
 */
export function serviceDurationMinutes(times: ServiceTimes): number {
  const departure = timeOfDayToMinutes(times.departureTime);
  const arrival = timeOfDayToMinutes(times.arrivalTime);

  return times.endsNextDay ? MINUTES_PER_DAY - departure + arrival : arrival - departure;
}

export function validateServiceTimes(times: ServiceTimes): ServiceTimeViolation[] {
  // Next-day: whatever the driver entered stands (change request 2026-09-09).
  if (times.endsNextDay) return [];

  const departure = timeOfDayToMinutes(times.departureTime);
  const arrival = timeOfDayToMinutes(times.arrivalTime);

  // The client's same-day rule: the clock must move forwards.
  return arrival > departure
    ? []
    : [{ code: 'ARRIVAL_NOT_AFTER_DEPARTURE', field: 'arrivalTime' }];
}

export function areServiceTimesValid(times: ServiceTimes): boolean {
  return validateServiceTimes(times).length === 0;
}
