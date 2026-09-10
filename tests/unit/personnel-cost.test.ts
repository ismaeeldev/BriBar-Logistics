/**
 * "Coste fijo diario" (ERP roadmap Phase 5).
 */
import { describe, expect, it } from 'vitest';

import { computeDailyFixedCostCents, daysInMonth } from '@/modules/personnel/domain/personnel-cost';

describe('daysInMonth', () => {
  it('counts a 31-day month', () => {
    expect(daysInMonth(2026, 1)).toBe(31);
  });

  it('counts a 30-day month', () => {
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it('counts February in a non-leap year', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it('counts February in a leap year', () => {
    expect(daysInMonth(2028, 2)).toBe(29);
  });
});

describe('computeDailyFixedCostCents', () => {
  it('divides the total by the days in that month', () => {
    // 3100 cents over 31 days = 100 cents/day exactly.
    expect(computeDailyFixedCostCents(3_100, 2026, 1)).toBe(100);
  });

  it('rounds to the nearest cent', () => {
    // 100000 / 30 = 3333.33... -> 3333.
    expect(computeDailyFixedCostCents(100_000, 2026, 4)).toBe(3_333);
  });

  it('uses the same month/year to pick the right divisor', () => {
    const total = 290_000;
    // 28 days in Feb 2026 vs 29 in Feb 2028 - different results for the same total.
    expect(computeDailyFixedCostCents(total, 2026, 2)).toBe(Math.round(total / 28));
    expect(computeDailyFixedCostCents(total, 2028, 2)).toBe(Math.round(total / 29));
  });
});
