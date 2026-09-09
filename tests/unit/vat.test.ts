/**
 * VAT arithmetic (ERP roadmap Phase 1).
 */
import { describe, expect, it } from 'vitest';

import { applyVat, baseFromGross, VAT_RATE_PERCENT } from '@/modules/shared/domain/vat';

describe('VAT_RATE_PERCENT', () => {
  it('matches the five rates in the client spreadsheet', () => {
    expect(VAT_RATE_PERCENT).toEqual({
      STANDARD: 21,
      REDUCED: 10,
      SUPER_REDUCED: 4,
      ZERO: 0,
      EXEMPT: 0,
    });
  });
});

describe('applyVat', () => {
  it('applies the standard 21% rate', () => {
    expect(applyVat(10_000, 'STANDARD')).toEqual({ vatCents: 2_100, totalCents: 12_100 });
  });

  it('applies the reduced 10% rate (fuel, per the category rule)', () => {
    expect(applyVat(10_000, 'REDUCED')).toEqual({ vatCents: 1_000, totalCents: 11_000 });
  });

  it('applies zero for an exempt amount', () => {
    expect(applyVat(10_000, 'EXEMPT')).toEqual({ vatCents: 0, totalCents: 10_000 });
  });

  it('rounds to the nearest cent', () => {
    // 333 * 21% = 69.93 -> rounds to 70.
    expect(applyVat(333, 'STANDARD')).toEqual({ vatCents: 70, totalCents: 403 });
  });

  it('keeps base + vat == total for every rate', () => {
    for (const rate of ['STANDARD', 'REDUCED', 'SUPER_REDUCED', 'ZERO', 'EXEMPT'] as const) {
      const { vatCents, totalCents } = applyVat(12_345, rate);
      expect(12_345 + vatCents).toBe(totalCents);
    }
  });
});

describe('baseFromGross', () => {
  it('inverts the spreadsheet\'s own "Total/1.21" formula', () => {
    // 121.00 gross at 21% -> 100.00 base.
    expect(baseFromGross(12_100, 'STANDARD')).toBe(10_000);
  });

  it('returns the gross unchanged at a zero rate', () => {
    expect(baseFromGross(10_000, 'ZERO')).toBe(10_000);
    expect(baseFromGross(10_000, 'EXEMPT')).toBe(10_000);
  });

  it('round-trips with applyVat for a clean amount', () => {
    const { totalCents } = applyVat(10_000, 'STANDARD');
    expect(baseFromGross(totalCents, 'STANDARD')).toBe(10_000);
  });
});
