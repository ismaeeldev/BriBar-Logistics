/**
 * "Base imponible = tarifa + suplemento" (ERP roadmap Phase 4).
 */
import { describe, expect, it } from 'vitest';

import { computeBaseCents } from '@/modules/services/domain/billing';

describe('computeBaseCents', () => {
  it('is the rate alone when there is no supplement', () => {
    expect(computeBaseCents(18_000, null)).toBe(18_000);
  });

  it('adds the supplement to the rate', () => {
    expect(computeBaseCents(18_000, 2_500)).toBe(20_500);
  });

  it('is null when there is no rate, supplement or not', () => {
    expect(computeBaseCents(null, null)).toBeNull();
    expect(computeBaseCents(null, 2_500)).toBeNull();
  });

  it('treats a zero rate as a real rate, not a missing one', () => {
    expect(computeBaseCents(0, 500)).toBe(500);
  });
});
