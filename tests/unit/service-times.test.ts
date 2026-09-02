/**
 * Departure/arrival ordering (client decision #3).
 *
 * The rule the client asked for — reject a same-day service whose arrival
 * precedes its departure — and the overnight case SRS 31.3 must not make
 * impossible.
 */
import { describe, expect, it } from 'vitest';

import { asTimeOfDay } from '@/lib/time/time-of-day';
import {
  areServiceTimesValid,
  serviceDurationMinutes,
  validateServiceTimes,
} from '@/modules/services/domain/service-times';

function times(departure: string, arrival: string, endsNextDay = false) {
  return {
    departureTime: asTimeOfDay(departure),
    arrivalTime: asTimeOfDay(arrival),
    endsNextDay,
  };
}

function codesFor(...args: Parameters<typeof times>): string[] {
  return validateServiceTimes(times(...args)).map((violation) => violation.code);
}

describe('same-day services', () => {
  it('accepts a normal shift', () => {
    expect(validateServiceTimes(times('07:45', '15:30'))).toEqual([]);
  });

  it('accepts a one-minute service', () => {
    expect(areServiceTimesValid(times('07:45', '07:46'))).toBe(true);
  });

  it('rejects an arrival earlier than the departure', () => {
    // The transposition typo the client asked us to catch: 07:45 and 15:30
    // entered the wrong way round.
    expect(codesFor('15:30', '07:45')).toEqual(['ARRIVAL_NOT_AFTER_DEPARTURE']);
  });

  it('rejects an arrival equal to the departure', () => {
    expect(codesFor('07:45', '07:45')).toEqual(['ARRIVAL_NOT_AFTER_DEPARTURE']);
  });

  it('reports the violation against the arrival field', () => {
    expect(validateServiceTimes(times('15:30', '07:45'))[0]?.field).toBe('arrivalTime');
  });
});

describe('overnight services (SRS 31.3)', () => {
  it('accepts a run that crosses midnight when flagged', () => {
    // The case a naive `arrival > departure` rule would make impossible to
    // record, which is why the flag exists rather than a blanket rejection.
    expect(validateServiceTimes(times('22:00', '02:00', true))).toEqual([]);
  });

  it('accepts a run ending one minute past midnight', () => {
    expect(areServiceTimesValid(times('23:59', '00:00', true))).toBe(true);
  });

  it('rejects an overnight flag that would make the service 24 hours or more', () => {
    // Flagged as overnight but arriving later on the clock than it departed
    // means at least a full day. That is a different data-entry error, not a
    // route sheet.
    expect(codesFor('07:00', '09:00', true)).toEqual(['OVERNIGHT_SPAN_TOO_LONG']);
  });

  it('rejects an overnight flag on a service that arrives at its departure time', () => {
    expect(codesFor('07:00', '07:00', true)).toEqual(['OVERNIGHT_SPAN_TOO_LONG']);
  });

  it('reports that violation against the flag, not the times', () => {
    // The times are plausible; it is the flag that is wrong, and that is the
    // control the driver should be looking at.
    expect(validateServiceTimes(times('07:00', '09:00', true))[0]?.field).toBe('endsNextDay');
  });
});

describe('serviceDurationMinutes', () => {
  it('measures a same-day service', () => {
    expect(serviceDurationMinutes(times('07:45', '15:30'))).toBe(465);
  });

  it('measures across midnight', () => {
    expect(serviceDurationMinutes(times('22:00', '02:00', true))).toBe(240);
  });

  it('stays inside (0, 1440) for every accepted pair', () => {
    // The property that makes the two ordering rules equivalent to "longer
    // than zero, shorter than a day".
    let accepted = 0;

    for (let departure = 0; departure < 24 * 60; departure += 37) {
      for (let arrival = 0; arrival < 24 * 60; arrival += 41) {
        for (const endsNextDay of [false, true]) {
          const hh = (m: number) =>
            `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
          const candidate = times(hh(departure), hh(arrival), endsNextDay);
          if (!areServiceTimesValid(candidate)) continue;

          accepted += 1;
          const duration = serviceDurationMinutes(candidate);
          expect(duration).toBeGreaterThan(0);
          expect(duration).toBeLessThan(24 * 60);
        }
      }
    }

    expect(accepted).toBeGreaterThan(0);
  });
});
