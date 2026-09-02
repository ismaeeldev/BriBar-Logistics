/**
 * Time handling (SRS 31.3).
 *
 * The bugs this file guards against do not show up on a developer's machine in
 * Western Europe during winter, which is exactly why they are worth a test:
 * a UTC server, a summer offset, or a driver submitting just after midnight
 * are all enough to surface them in production.
 */
import { describe, expect, it } from 'vitest';

import {
  businessDateFor,
  businessDateRange,
  formatBusinessDate,
  formatBusinessDateTime,
  parseIsoDate,
  toIsoDate,
} from '@/lib/time/business-date';
import {
  asTimeOfDay,
  dateToTimeOfDay,
  isTimeOfDay,
  timeOfDayToDate,
  timeOfDayToMinutes,
} from '@/lib/time/time-of-day';
import { formatServiceCode, isServiceCode } from '@/modules/services/domain/service-code';

describe('time of day', () => {
  it('accepts valid 24-hour readings', () => {
    for (const value of ['00:00', '07:45', '12:00', '23:59']) {
      expect(isTimeOfDay(value)).toBe(true);
    }
  });

  it('rejects malformed readings', () => {
    for (const value of ['24:00', '7:45', '07:60', '0745', '07:45:00', '', 'noon']) {
      expect(isTimeOfDay(value)).toBe(false);
    }
  });

  it('round-trips through the database representation', () => {
    for (const value of ['00:00', '07:45', '13:07', '23:59']) {
      const time = asTimeOfDay(value);
      expect(dateToTimeOfDay(timeOfDayToDate(time))).toBe(value);
    }
  });

  it('pins the database representation to UTC on the epoch date', () => {
    // The mapper must not depend on the server's own timezone. If it used
    // local accessors, a machine at UTC+1 would store 06:45 for this input.
    const encoded = timeOfDayToDate(asTimeOfDay('07:45'));

    expect(encoded.toISOString()).toBe('1970-01-01T07:45:00.000Z');
  });

  it('converts to minutes since midnight', () => {
    expect(timeOfDayToMinutes(asTimeOfDay('00:00'))).toBe(0);
    expect(timeOfDayToMinutes(asTimeOfDay('07:45'))).toBe(465);
    expect(timeOfDayToMinutes(asTimeOfDay('23:59'))).toBe(1439);
  });

  it('throws when asked to narrow a malformed string', () => {
    expect(() => asTimeOfDay('25:00')).toThrow(/HH:MM/);
  });
});

describe('business date (SRS 31.3)', () => {
  it('uses the calendar day in the configured timezone, not in UTC', () => {
    // 23:30 UTC on 1 September is already 00:30 on 2 September in Lisbon
    // summer time. Deriving the date from the UTC instant would file this
    // service under the wrong day.
    const instant = new Date('2026-09-01T23:30:00.000Z');

    expect(toIsoDate(businessDateFor(instant, 'Europe/Lisbon'))).toBe('2026-09-02');
    expect(toIsoDate(businessDateFor(instant, 'UTC'))).toBe('2026-09-01');
  });

  it('handles a timezone behind UTC in the other direction', () => {
    const instant = new Date('2026-09-02T02:00:00.000Z');

    expect(toIsoDate(businessDateFor(instant, 'America/Sao_Paulo'))).toBe('2026-09-01');
  });

  it('produces a date pinned to UTC midnight, as a @db.Date column expects', () => {
    const businessDate = businessDateFor(new Date('2026-09-02T12:00:00.000Z'), 'Europe/Lisbon');

    expect(businessDate.toISOString()).toBe('2026-09-02T00:00:00.000Z');
  });

  it('renders a business date without shifting it into a zone', () => {
    // A @db.Date has no time. Formatting it in a zone behind UTC would show
    // the previous day.
    const businessDate = new Date('2026-09-02T00:00:00.000Z');

    expect(formatBusinessDate(businessDate)).toBe('02/09/2026');
  });

  it('renders an audit instant in the business timezone', () => {
    const instant = new Date('2026-09-02T09:15:00.000Z');

    expect(formatBusinessDateTime(instant, 'Europe/Lisbon')).toBe('02/09/2026 10:15');
    expect(formatBusinessDateTime(instant, 'UTC')).toBe('02/09/2026 09:15');
  });

  it('parses ISO date filters and rejects impossible days', () => {
    expect(toIsoDate(parseIsoDate('2026-09-02')!)).toBe('2026-09-02');
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('02/09/2026')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
  });

  it('builds a half-open range that includes the final day (SRS 16.3)', () => {
    const range = businessDateRange(
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2026-09-30T00:00:00.000Z'),
    );

    expect(range.gte?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    // Exclusive upper bound one day past the requested end, so services dated
    // 30 September are matched.
    expect(range.lt?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('supports an open-ended range', () => {
    expect(businessDateRange(new Date('2026-09-01T00:00:00.000Z'), null).lt).toBeUndefined();
    expect(businessDateRange(null, null)).toEqual({});
  });
});

describe('service code (SRS 19.1)', () => {
  it('formats prefix, business date and zero-padded sequence', () => {
    expect(formatServiceCode('SRV', new Date('2026-09-02T00:00:00.000Z'), 42)).toBe(
      'SRV-20260902-000042',
    );
  });

  it('accepts a bigint sequence value, which is what nextval returns', () => {
    expect(formatServiceCode('SRV', new Date('2026-09-02T00:00:00.000Z'), 7n)).toBe(
      'SRV-20260902-000007',
    );
  });

  it('widens rather than truncates past the padding width', () => {
    expect(formatServiceCode('SRV', new Date('2026-09-02T00:00:00.000Z'), 1_234_567)).toBe(
      'SRV-20260902-1234567',
    );
  });

  it('honours a configured prefix', () => {
    expect(formatServiceCode('BRB', new Date('2026-01-05T00:00:00.000Z'), 1)).toBe(
      'BRB-20260105-000001',
    );
  });

  it('recognises its own output', () => {
    const code = formatServiceCode('SRV', new Date('2026-09-02T00:00:00.000Z'), 42);

    expect(isServiceCode(code)).toBe(true);
    expect(isServiceCode('SRV-2026-42')).toBe(false);
    expect(isServiceCode('not a code')).toBe(false);
  });
});
