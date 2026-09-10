/**
 * Odometer delta and fuel consumption (ERP roadmap Phase 2).
 */
import { describe, expect, it } from 'vitest';

import { consumptionMlPer100Km, kmSinceLast } from '@/modules/refuelling/domain/consumption';

describe('kmSinceLast', () => {
  it('computes the delta from the previous reading', () => {
    expect(kmSinceLast(10_500, 10_000)).toBe(500);
  });

  it('returns null for a vehicle first refuel (no previous reading)', () => {
    expect(kmSinceLast(10_000, null)).toBeNull();
  });

  it('returns null when the reading did not advance (out-of-order entry)', () => {
    expect(kmSinceLast(10_000, 10_000)).toBeNull();
  });

  it('returns null when the reading went backwards', () => {
    expect(kmSinceLast(9_000, 10_000)).toBeNull();
  });
});

describe('consumptionMlPer100Km', () => {
  it('scales litres pumped to a per-100km rate', () => {
    // 50 L over 500 km -> 10 L/100km -> 10,000 mL/100km.
    expect(consumptionMlPer100Km(50_000, 500)).toBe(10_000);
  });

  it('rounds to the nearest millilitre', () => {
    expect(consumptionMlPer100Km(33_000, 700)).toBe(4_714); // 4714.28... -> 4714
  });

  it('returns null when there is no distance to divide by', () => {
    expect(consumptionMlPer100Km(50_000, null)).toBeNull();
  });

  it('returns null for a zero or negative distance', () => {
    expect(consumptionMlPer100Km(50_000, 0)).toBeNull();
  });
});
