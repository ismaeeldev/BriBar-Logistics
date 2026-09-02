/**
 * Mileage arithmetic and the odometer invariants (SRS 6.3, 6.4, 10).
 *
 * Pure functions with no imports from Prisma, Next.js or Zod. SRS 30.1
 * requires calculations to be unit-testable independently of the UI, and this
 * module is where that requirement is met: everything here can be exercised
 * with plain numbers and no database.
 *
 * The browser is free to run these same functions for a live preview
 * (SRS 10.2), but the server calls them again before every write and the
 * server's answer is the one that is stored. Nothing in the API accepts
 * `actualKm` or `serviceKm` from a request body.
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
 * No rounding, no clamping. Callers validate first; this function only does
 * the arithmetic, so a violated invariant shows up as a negative number in a
 * test rather than being silently absorbed here.
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
  | 'END_BASE_BEFORE_START_BASE'
  | 'END_DASHBOARD_BEFORE_END_BASE'
  | 'SERVICE_KM_EXCEEDS_ACTUAL_KM';

export interface MileageViolation {
  code: MileageViolationCode;
  /**
   * The input the driver should correct, or `'root'` for a violation that
   * belongs to the set as a whole. Chosen so the message lands on the field
   * furthest along the sequence - the one most likely mistyped - which is what
   * SRS 24.1 means by identifying the field and the reason.
   */
  field: keyof OdometerReadings | 'root';
  message: string;
}

const READING_LABELS: Record<keyof OdometerReadings, string> = {
  startDashboardKm: 'Start Dashboard KM',
  startBaseKm: 'Start Base KM',
  endBaseKm: 'End Base KM',
  endDashboardKm: 'End Dashboard KM',
};

const ORDERED_FIELDS: (keyof OdometerReadings)[] = [
  'startDashboardKm',
  'startBaseKm',
  'endBaseKm',
  'endDashboardKm',
];

/**
 * Every way a set of readings can be wrong, in the order a driver would work
 * down the form.
 *
 * Returns a list rather than throwing on the first problem so the UI can show
 * all of them at once - SRS 24.1 requires that a user not lose valid entries
 * because another field failed.
 *
 * Zero-distance is deliberately allowed: SRS 26.3 lists it as an edge case to
 * test, not to reject, and a service that starts and ends at the same
 * odometer reading is operationally real.
 */
export function validateMileage(readings: OdometerReadings): MileageViolation[] {
  const violations: MileageViolation[] = [];

  // Per-field checks first. Ordering comparisons between a number and a NaN
  // are all false, so they would silently pass without this pass running first.
  for (const field of ORDERED_FIELDS) {
    const value = readings[field];
    const label = READING_LABELS[field];

    if (!Number.isInteger(value)) {
      violations.push({
        code: 'NOT_A_WHOLE_NUMBER',
        field,
        message: `${label} must be a whole number of kilometres.`,
      });
      continue;
    }

    if (value < 0) {
      violations.push({
        code: 'NEGATIVE_READING',
        field,
        message: `${label} cannot be negative.`,
      });
      continue;
    }

    if (value > MAX_ODOMETER_KM) {
      violations.push({
        code: 'READING_TOO_LARGE',
        field,
        message: `${label} looks too large. Check the reading and try again.`,
      });
    }
  }

  // An ordering comparison against an already-invalid reading would produce a
  // second, confusing message about a field the driver has not got to yet.
  if (violations.length > 0) return violations;

  // SRS 10.3:
  //   Start Dashboard KM <= Start Base KM <= End Base KM <= End Dashboard KM
  if (readings.startBaseKm < readings.startDashboardKm) {
    violations.push({
      code: 'START_BASE_BEFORE_START_DASHBOARD',
      field: 'startBaseKm',
      message: 'Start Base KM cannot be lower than Start Dashboard KM.',
    });
  }

  if (readings.endBaseKm < readings.startBaseKm) {
    violations.push({
      code: 'END_BASE_BEFORE_START_BASE',
      field: 'endBaseKm',
      message: 'End Base KM cannot be lower than Start Base KM.',
    });
  }

  if (readings.endDashboardKm < readings.endBaseKm) {
    violations.push({
      code: 'END_DASHBOARD_BEFORE_END_BASE',
      field: 'endDashboardKm',
      message: 'End Dashboard KM cannot be lower than End Base KM.',
    });
  }

  if (violations.length > 0) return violations;

  // Implied by the chain above, and checked anyway: SRS 10.3 states it as its
  // own rule, and the database enforces it as its own CHECK constraint. If
  // this ever fires, one of the three comparisons above has a bug.
  const { actualKm, serviceKm } = calculateMileage(readings);
  if (serviceKm > actualKm) {
    violations.push({
      code: 'SERVICE_KM_EXCEEDS_ACTUAL_KM',
      field: 'root',
      message: 'Service Km cannot exceed Actual Km.',
    });
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
