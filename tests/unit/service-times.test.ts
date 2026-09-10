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

describe('next-day services (SRS 31.3, change request 2026-09-09)', () => {
  it('accepts a run that crosses midnight when flagged', () => {
    expect(validateServiceTimes(times('22:00', '02:00', true))).toEqual([]);
  });

  it('accepts a run ending one minute past midnight', () => {
    expect(areServiceTimesValid(times('23:59', '00:00', true))).toBe(true);
  });

  it('accepts any arrival time once the flag is set', () => {
    // The 2026-09-09 change: ticking "llega al día siguiente" makes the
    // arrival time the driver entered stand, even if it is later on the clock
    // than the departure (a service spanning more than 24 hours).
    expect(validateServiceTimes(times('07:00', '09:00', true))).toEqual([]);
    expect(validateServiceTimes(times('07:00', '07:00', true))).toEqual([]);
    expect(validateServiceTimes(times('08:00', '20:00', true))).toEqual([]);
  });
});

describe('serviceDurationMinutes', () => {
  it('measures a same-day service', () => {
    expect(serviceDurationMinutes(times('07:45', '15:30'))).toBe(465);
  });

  it('measures across midnight', () => {
    expect(serviceDurationMinutes(times('22:00', '02:00', true))).toBe(240);
  });

  it('is always positive; same-day is also bounded by a day', () => {
    let sameDay = 0;

    for (let departure = 0; departure < 24 * 60; departure += 37) {
      for (let arrival = 0; arrival < 24 * 60; arrival += 41) {
        for (const endsNextDay of [false, true]) {
          const hh = (m: number) =>
            `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
          const candidate = times(hh(departure), hh(arrival), endsNextDay);
          if (!areServiceTimesValid(candidate)) continue;

          const duration = serviceDurationMinutes(candidate);
          expect(duration).toBeGreaterThan(0);
          if (!endsNextDay) {
            sameDay += 1;
            expect(duration).toBeLessThan(24 * 60);
          }
        }
      }
    }

    expect(sameDay).toBeGreaterThan(0);
  });
});
