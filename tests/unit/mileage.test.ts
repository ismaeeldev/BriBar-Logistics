/**
 * SRS 26.3 (Mileage Tests), clause by clause.
 *
 * These run against pure functions with no database, which is the point of
 * SRS 30.1: the arithmetic the client signs off on is verifiable in
 * milliseconds and cannot be broken by an unrelated schema change.
 */
import { describe, expect, it } from 'vitest';

import {
  MAX_ODOMETER_KM,
  calculateMileage,
  isValidMileage,
  validateAndCalculateMileage,
  validateMileage,
  type OdometerReadings,
} from '@/modules/services/domain/mileage';

/** A valid, unremarkable route: 100 km total, 60 km of it under contract. */
const VALID: OdometerReadings = {
  startDashboardKm: 10_000,
  startBaseKm: 10_020,
  endBaseKm: 10_080,
  endDashboardKm: 10_100,
};

function codesFor(readings: OdometerReadings): string[] {
  return validateMileage(readings).map((violation) => violation.code);
}

describe('calculateMileage', () => {
  it('computes Actual Km as End Dashboard minus Start Dashboard (SRS 10.1)', () => {
    expect(calculateMileage(VALID).actualKm).toBe(100);
  });

  it('computes Service Km as End Base minus Start Base (SRS 10.1)', () => {
    expect(calculateMileage(VALID).serviceKm).toBe(60);
  });

  it('is exact for large odometer readings', () => {
    expect(
      calculateMileage({
        startDashboardKm: 998_877,
        startBaseKm: 998_900,
        endBaseKm: 999_100,
        endDashboardKm: 999_123,
      }),
    ).toEqual({ actualKm: 246, serviceKm: 200 });
  });
});

describe('validateMileage', () => {
  it('accepts a normal increasing sequence', () => {
    expect(validateMileage(VALID)).toEqual([]);
    expect(isValidMileage(VALID)).toBe(true);
  });

  it('accepts the zero-distance edge case (SRS 26.3)', () => {
    // All four readings equal: operationally real, and SRS 26.3 lists this as
    // a case to test rather than to reject.
    const readings = {
      startDashboardKm: 5_000,
      startBaseKm: 5_000,
      endBaseKm: 5_000,
      endDashboardKm: 5_000,
    };

    expect(validateMileage(readings)).toEqual([]);
    expect(calculateMileage(readings)).toEqual({ actualKm: 0, serviceKm: 0 });
  });

  it('accepts a zero-length service inside a non-zero route', () => {
    expect(validateMileage({ ...VALID, startBaseKm: 10_050, endBaseKm: 10_050 })).toEqual([]);
  });

  it('rejects End Dashboard lower than Start Dashboard (SRS 26.3)', () => {
    // Reported against endDashboardKm via its comparison with endBaseKm, which
    // is the field the driver needs to correct.
    expect(codesFor({ ...VALID, endDashboardKm: 9_000 })).toContain(
      'END_DASHBOARD_BEFORE_END_BASE',
    );
  });

  it('rejects End Base lower than Start Base (SRS 26.3)', () => {
    expect(codesFor({ ...VALID, endBaseKm: 10_010 })).toContain('END_BASE_BEFORE_START_BASE');
  });

  it('rejects Start Base lower than Start Dashboard (SRS 26.3)', () => {
    expect(codesFor({ ...VALID, startBaseKm: 9_990 })).toContain(
      'START_BASE_BEFORE_START_DASHBOARD',
    );
  });

  it('rejects End Base higher than End Dashboard (SRS 26.3)', () => {
    expect(codesFor({ ...VALID, endBaseKm: 10_500 })).toContain(
      'END_DASHBOARD_BEFORE_END_BASE',
    );
  });

  it('rejects negative readings (SRS 10.3)', () => {
    expect(codesFor({ ...VALID, startDashboardKm: -1 })).toEqual(['NEGATIVE_READING']);
  });

  it('rejects fractional readings (SRS 10.3 - whole-number mileage)', () => {
    expect(codesFor({ ...VALID, endBaseKm: 10_080.5 })).toEqual(['NOT_A_WHOLE_NUMBER']);
  });

  it('rejects NaN rather than letting it slip through the ordering checks', () => {
    // Every comparison against NaN is false, so without the per-field pass
    // running first this would validate as a correctly ordered sequence.
    expect(codesFor({ ...VALID, endBaseKm: Number.NaN })).toEqual(['NOT_A_WHOLE_NUMBER']);
  });

  it('rejects a reading beyond any plausible odometer', () => {
    expect(codesFor({ ...VALID, endDashboardKm: MAX_ODOMETER_KM + 1 })).toEqual([
      'READING_TOO_LARGE',
    ]);
  });

  it('reports every bad field at once so the driver fixes them in one pass (SRS 24.1)', () => {
    expect(
      codesFor({
        startDashboardKm: -1,
        startBaseKm: -2,
        endBaseKm: 100,
        endDashboardKm: 200,
      }),
    ).toEqual(['NEGATIVE_READING', 'NEGATIVE_READING']);
  });

  it('does not pile ordering errors on top of a malformed field', () => {
    // startBaseKm is unusable, so complaining that endBaseKm is out of order
    // relative to it would be noise about a field the driver has not reached.
    const violations = validateMileage({ ...VALID, startBaseKm: Number.NaN });

    expect(violations).toHaveLength(1);
    expect(violations[0]?.code).toBe('NOT_A_WHOLE_NUMBER');
  });

  it('never yields a negative Actual Km or Service Km for accepted input (SRS 10.3)', () => {
    // Property check across the boundary conditions: whenever validation
    // passes, both calculated values must be non-negative.
    const points = [0, 1, 2, 3];

    for (const a of points) {
      for (const b of points) {
        for (const c of points) {
          for (const d of points) {
            const readings = {
              startDashboardKm: a,
              startBaseKm: b,
              endBaseKm: c,
              endDashboardKm: d,
            };
            if (!isValidMileage(readings)) continue;

            const { actualKm, serviceKm } = calculateMileage(readings);
            expect(actualKm).toBeGreaterThanOrEqual(0);
            expect(serviceKm).toBeGreaterThanOrEqual(0);
            // SRS 10.3, stated separately but implied by the ordering chain.
            expect(serviceKm).toBeLessThanOrEqual(actualKm);
          }
        }
      }
    }
  });
});

describe('validateAndCalculateMileage', () => {
  it('returns the calculated values when the readings are valid', () => {
    const result = validateAndCalculateMileage(VALID);

    expect(result.ok).toBe(true);
    expect(result.ok && result.mileage).toEqual({ actualKm: 100, serviceKm: 60 });
  });

  it('returns violations instead of a calculation when the readings are not', () => {
    const result = validateAndCalculateMileage({ ...VALID, endBaseKm: 1 });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.violations.length).toBeGreaterThan(0);
  });
});
