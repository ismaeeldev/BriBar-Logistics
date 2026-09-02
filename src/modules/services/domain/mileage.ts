/**
 * Mileage arithmetic and the odometer invariants (SRS 6.3, 6.4, 10).
 *
 * Pure functions with no imports at all - not Prisma, not Next.js, not Zod, and
 * not the message catalogue. SRS 30.1 requires calculations to be
 * unit-testable independently of the UI, and this module is where that is met:
 * everything here runs on plain numbers with no database and no framework.
 *
 * Violations are returned as codes rather than sentences. The Spanish wording
 * lives in `src/lib/i18n/messages.ts`, which is what lets this file stay
 * dependency-free while the client can still review every message in one place.
 *
 * The browser may run these same functions for a live preview (SRS 10.2), but
 * the server calls them again before every write and the server's answer is the
 * one that is stored. Nothing in the API accepts `actualKm` or `serviceKm` from
 * a request body.
 */

/** The four readings a driver enters (SRS 9.3). */
export interface OdometerReadings {
  startDashboardKm: number;
  startBaseKm: number;
  endBaseKm: number;
  endDashboardKm: number;
}

/** The two values the server derives and stores (SRS 6.4). */
export interface CalculatedMileage {
  actualKm: number;
  serviceKm: number;
}

/**
 * Upper bound on a single reading.
 *
 * Real odometers roll over around seven digits, so anything larger is a typo -
 * a mistyped `1234567` for `123456` would otherwise pass every ordering check
 * and quietly record a 1.1-million-kilometre route.
 */
export const MAX_ODOMETER_KM = 9_999_999;

/**
 * SRS 10.1, verbatim:
 *
 *   Actual Km  = End Dashboard KM - Start Dashboard KM
 *   Service Km = End Base KM      - Start Base KM
 *
 * No rounding, no clamping. Callers validate first; this function only does the
 * arithmetic, so a violated invariant shows up as a negative number in a test
 * rather than being silently absorbed here.
 */
export function calculateMileage(readings: OdometerReadings): CalculatedMileage {
  return {
    actualKm: readings.endDashboardKm - readings.startDashboardKm,
    serviceKm: readings.endBaseKm - readings.startBaseKm,
  };
}

export type MileageViolationCode =
  | 'NOT_A_WHOLE_NUMBER'
  | 'NEGATIVE_READING'
  | 'READING_TOO_LARGE'
  | 'START_BASE_BEFORE_START_DASHBOARD'
  | 'END_BASE_NOT_AFTER_START_BASE'
  | 'END_DASHBOARD_BEFORE_END_BASE'
  | 'SERVICE_KM_EXCEEDS_ACTUAL_KM';

export interface MileageViolation {
  code: MileageViolationCode;
  /**
   * The input the driver should correct, or `'root'` for a violation belonging
   * to the set as a whole. Chosen so the message lands on the field furthest
   * along the sequence - the one most likely mistyped - which is what SRS 24.1
   * means by identifying the field and the reason.
   */
  field: keyof OdometerReadings | 'root';
}

const ORDERED_FIELDS: (keyof OdometerReadings)[] = [
  'startDashboardKm',
  'startBaseKm',
  'endBaseKm',
  'endDashboardKm',
];

/**
 * Every way a set of readings can be wrong, in the order a driver works down
 * the form.
 *
 * Returns a list rather than throwing on the first problem, so the UI can show
 * all of them at once - SRS 24.1 requires that a user not lose valid entries
 * because another field failed.
 *
 * ## The ordering rule
 *
 * SRS 10.3 states the chain as non-strict throughout:
 *
 *     Start Dashboard <= Start Base <= End Base <= End Dashboard
 *
 * The client has since ruled out zero-distance services
 * (`docs/open-questions.md` #4), so one link is tightened:
 *
 *     Start Dashboard <= Start Base < End Base <= End Dashboard
 *                                  ^ strict
 *
 * Only that link. Tightening the outer two as well would reject a truck that
 * begins the day already parked at the loading base - a common real case where
 * Start Dashboard legitimately equals Start Base.
 *
 * Requiring `End Base > Start Base` gives `serviceKm > 0` directly, and
 * `actualKm >= serviceKm` follows from the outer links, so `actualKm > 0` comes
 * for free. One strict comparison delivers both guarantees.
 */
export function validateMileage(readings: OdometerReadings): MileageViolation[] {
  const violations: MileageViolation[] = [];

  // Per-field checks first. Every ordering comparison against NaN is false, so
  // a malformed reading would silently pass the chain without this pass.
  for (const field of ORDERED_FIELDS) {
    const value = readings[field];

    if (!Number.isInteger(value)) {
      violations.push({ code: 'NOT_A_WHOLE_NUMBER', field });
      continue;
    }
    if (value < 0) {
      violations.push({ code: 'NEGATIVE_READING', field });
      continue;
    }
    if (value > MAX_ODOMETER_KM) {
      violations.push({ code: 'READING_TOO_LARGE', field });
    }
  }

  // An ordering comparison against an already-invalid reading would produce a
  // second, confusing message about a field the driver has not reached yet.
  if (violations.length > 0) return violations;

  if (readings.startBaseKm < readings.startDashboardKm) {
    violations.push({ code: 'START_BASE_BEFORE_START_DASHBOARD', field: 'startBaseKm' });
  }

  // Strict: the service itself must cover distance (client decision #4).
  if (readings.endBaseKm <= readings.startBaseKm) {
    violations.push({ code: 'END_BASE_NOT_AFTER_START_BASE', field: 'endBaseKm' });
  }

  if (readings.endDashboardKm < readings.endBaseKm) {
    violations.push({ code: 'END_DASHBOARD_BEFORE_END_BASE', field: 'endDashboardKm' });
  }

  if (violations.length > 0) return violations;

  // Implied by the chain above, and checked anyway: SRS 10.3 states it as its
  // own rule and the database enforces it as its own CHECK constraint. If this
  // ever fires, one of the three comparisons above has a bug.
  const { actualKm, serviceKm } = calculateMileage(readings);
  if (serviceKm > actualKm) {
    violations.push({ code: 'SERVICE_KM_EXCEEDS_ACTUAL_KM', field: 'root' });
  }

  return violations;
}

export function isValidMileage(readings: OdometerReadings): boolean {
  return validateMileage(readings).length === 0;
}

/**
 * Validates and calculates in one step.
 *
 * The only entry point the service layer should use on a write path: it makes
 * it impossible to store a calculated value without having checked its inputs.
 */
export function validateAndCalculateMileage(
  readings: OdometerReadings,
): { ok: true; mileage: CalculatedMileage } | { ok: false; violations: MileageViolation[] } {
  const violations = validateMileage(readings);
  if (violations.length > 0) return { ok: false, violations };
  return { ok: true, mileage: calculateMileage(readings) };
}
