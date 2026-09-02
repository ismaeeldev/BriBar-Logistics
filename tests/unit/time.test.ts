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
  formatBusinessDateValue,
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
    // 23:30 UTC on 1 September is already 01:30 on 2 September in Madrid
    // summer time (CEST, UTC+2). Deriving the date from the UTC instant would
    // file this service under the wrong day.
    const instant = new Date('2026-09-01T23:30:00.000Z');

    expect(toIsoDate(businessDateFor(instant, 'Europe/Madrid'))).toBe('2026-09-02');
    expect(toIsoDate(businessDateFor(instant, 'UTC'))).toBe('2026-09-01');
  });

  it('handles a timezone behind UTC in the other direction', () => {
    const instant = new Date('2026-09-02T02:00:00.000Z');

    expect(toIsoDate(businessDateFor(instant, 'America/Sao_Paulo'))).toBe('2026-09-01');
  });

  it('produces a date pinned to UTC midnight, as a @db.Date column expects', () => {
    const businessDate = businessDateFor(new Date('2026-09-02T12:00:00.000Z'), 'Europe/Madrid');

    expect(businessDate.toISOString()).toBe('2026-09-02T00:00:00.000Z');
  });

  it('renders a business date as a pure string rearrangement', () => {
    // A calendar day has no time and no zone, so formatting it never touches
    // Date. An earlier version formatted through a timezone library and threw
    // in the browser while working on the server.
    expect(formatBusinessDate('2026-09-02')).toBe('02/09/2026');
    expect(formatBusinessDate('2026-01-05')).toBe('05/01/2026');
  });

  it('renders a @db.Date value via the Date-taking wrapper', () => {
    expect(formatBusinessDateValue(new Date('2026-09-02T00:00:00.000Z'))).toBe('02/09/2026');
  });

  it('renders an audit instant in the business timezone', () => {
    const instant = new Date('2026-09-02T09:15:00.000Z');

    expect(formatBusinessDateTime(instant, 'Europe/Madrid')).toBe('02/09/2026 11:15');
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

describe('service code (SRS 19.1, client decision #2)', () => {
  it('renders a sequence value as a plain decimal number', () => {
    // The client's 01Servicios register numbers services sequentially, and the
    // new system continues that series. No prefix, no date, no padding -
    // anything added here would break continuity with records the business
    // already treats as authoritative.
    expect(formatServiceCode(42)).toBe('42');
    expect(formatServiceCode(1)).toBe('1');
    expect(formatServiceCode(1_248)).toBe('1248');
  });

  it('accepts the bigint that nextval returns', () => {
    expect(formatServiceCode(7n)).toBe('7');
    expect(formatServiceCode(9_007_199_254_740_993n)).toBe('9007199254740993');
  });

  it('recognises its own output', () => {
    expect(isServiceCode(formatServiceCode(42))).toBe(true);
    expect(isServiceCode('1')).toBe(true);
  });

  it('rejects anything that is not a bare positive number', () => {
    // Leading zeroes are rejected so admin search treats "007" as a search
    // term rather than as service 7.
    for (const value of ['007', '', '-1', '1.5', 'SRV-42', '42a', ' 42']) {
      expect(isServiceCode(value)).toBe(false);
    }
  });
});
