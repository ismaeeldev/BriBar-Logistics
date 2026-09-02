/**
 * Departure and arrival ordering (SRS 9.3, 31.3 + client decision #3).
 *
 * ## Why this module exists
 *
 * SRS 31.3 declines overnight logic for V1 — "unless a later business rule
 * requires it". The client has now stated one: a service whose arrival is
 * earlier than its departure *on the same day* is a mistake and must be
 * rejected.
 *
 * That rule cannot be applied to two bare clock times. `departs 22:00, arrives
 * 02:00` is either a transposition typo or a legitimate overnight run, and
 * nothing in the pair distinguishes them. Rejecting outright would make a real
 * overnight service impossible to record; accepting outright is the behaviour
 * the client asked us to stop.
 *
 * So the service carries one extra boolean, `endsNextDay`, and the pair becomes
 * unambiguous. This is the minimum the SRS's own escape clause allows: no
 * arrival date column, no timestamp migration, one flag.
 *
 * ## The rule
 *
 * A service lasts longer than zero and less than twenty-four hours. Stated
 * against the flag, that reduces to a single comparison each way:
 *
 *   endsNextDay = false   arrival must be strictly after  departure
 *   endsNextDay = true    arrival must be strictly before departure
 *
 * The second is not arbitrary. If a service ends the next day and arrives at or
 * after its departure time, it ran for twenty-four hours or more — which is not
 * a route sheet, it is a data-entry error of a different kind.
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
  | 'ARRIVAL_NOT_AFTER_DEPARTURE'
  /** Marked as ending the next day, but that would make it 24 hours or more. */
  | 'OVERNIGHT_SPAN_TOO_LONG';

export interface ServiceTimeViolation {
  code: ServiceTimeViolationCode;
  field: 'arrivalTime' | 'departureTime' | 'endsNextDay';
}

/**
 * How long the service ran, in minutes.
 *
 * Always in `(0, 1440)` for times that pass {@link validateServiceTimes}. Not
 * used by any V1 rule beyond that bound, but it is the natural basis for the
 * duration reporting anticipated by SRS 28.6.
 */
export function serviceDurationMinutes(times: ServiceTimes): number {
  const departure = timeOfDayToMinutes(times.departureTime);
  const arrival = timeOfDayToMinutes(times.arrivalTime);

  return times.endsNextDay ? MINUTES_PER_DAY - departure + arrival : arrival - departure;
}

export function validateServiceTimes(times: ServiceTimes): ServiceTimeViolation[] {
  const departure = timeOfDayToMinutes(times.departureTime);
  const arrival = timeOfDayToMinutes(times.arrivalTime);

  if (!times.endsNextDay) {
    // The client's rule: a same-day service must move forwards in time.
    return arrival > departure
      ? []
      : [{ code: 'ARRIVAL_NOT_AFTER_DEPARTURE', field: 'arrivalTime' }];
  }

  // Flagged as overnight, so the arrival belongs to the following calendar day.
  // Anything other than "earlier on the clock" means 24 hours or more.
  return arrival < departure ? [] : [{ code: 'OVERNIGHT_SPAN_TOO_LONG', field: 'endsNextDay' }];
}

export function areServiceTimesValid(times: ServiceTimes): boolean {
  return validateServiceTimes(times).length === 0;
}
