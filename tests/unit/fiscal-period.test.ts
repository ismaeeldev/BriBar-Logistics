/**
 * Fiscal period derivation (ERP roadmap Phase 1).
 */
import { describe, expect, it } from 'vitest';

import { fiscalPeriodFromParts, quarterOfMonth } from '@/modules/shared/domain/fiscal-period';

describe('quarterOfMonth', () => {
  it('maps January-March to Q1', () => {
    expect(quarterOfMonth(1)).toBe(1);
    expect(quarterOfMonth(2)).toBe(1);
    expect(quarterOfMonth(3)).toBe(1);
  });

  it('maps April-June to Q2', () => {
    expect(quarterOfMonth(4)).toBe(2);
    expect(quarterOfMonth(6)).toBe(2);
  });

  it('maps July-September to Q3', () => {
    expect(quarterOfMonth(7)).toBe(3);
    expect(quarterOfMonth(9)).toBe(3);
  });

  it('maps October-December to Q4', () => {
    expect(quarterOfMonth(10)).toBe(4);
    expect(quarterOfMonth(12)).toBe(4);
  });
});

describe('fiscalPeriodFromParts', () => {
  it('builds the full period from a calendar year and month', () => {
    expect(fiscalPeriodFromParts(2026, 9)).toEqual({ year: 2026, month: 9, quarter: 3 });
  });

  it('uses 1-12 for month, not a zero-indexed one', () => {
    expect(fiscalPeriodFromParts(2026, 1).quarter).toBe(1);
    expect(fiscalPeriodFromParts(2026, 12).quarter).toBe(4);
  });
});
