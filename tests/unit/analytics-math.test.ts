/**
 * The analytics formulas (ERP roadmap Phase 6, roadmap §3.4).
 */
import { describe, expect, it } from 'vitest';

import {
  averageFuelPriceCentsPerLiter,
  averageTicketCents,
  consumptionMlPer100Km,
  costPerKmCents,
  efficiencyRatio,
  emptyKm,
  estimatedFuelCents,
  investmentRecovery,
  marginCents,
  safeRatio,
} from '@/modules/analytics/domain/analytics-math';

describe('safeRatio', () => {
  it('divides when the denominator is positive', () => {
    expect(safeRatio(10, 4)).toBe(2.5);
  });

  it('is null for a zero or negative denominator', () => {
    expect(safeRatio(10, 0)).toBeNull();
    expect(safeRatio(10, -1)).toBeNull();
  });
});

describe('marginCents', () => {
  it('subtracts every cost from revenue', () => {
    expect(marginCents(100_000, [40_000, 20_000, 15_000])).toBe(25_000);
  });

  it('returns a negative margin as a real loss', () => {
    expect(marginCents(10_000, [12_000])).toBe(-2_000);
  });

  it('is revenue itself with no costs', () => {
    expect(marginCents(10_000, [])).toBe(10_000);
  });
});

describe('emptyKm', () => {
  it('is driven distance minus billable distance', () => {
    expect(emptyKm(1_000, 800)).toBe(200);
  });

  it('clamps a negative difference to zero', () => {
    expect(emptyKm(800, 1_000)).toBe(0);
  });
});

describe('costPerKmCents', () => {
  it('spreads a cost over a distance, rounded to the cent', () => {
    expect(costPerKmCents(10_000, 300)).toBe(33);
  });

  it('is null with no distance', () => {
    expect(costPerKmCents(10_000, 0)).toBeNull();
  });
});

describe('averageFuelPriceCentsPerLiter', () => {
  it('divides total paid by litres pumped', () => {
    // €72.00 for 45 L -> 160 c/L.
    expect(averageFuelPriceCentsPerLiter(7_200, 45_000)).toBe(160);
  });

  it('is null with no litres', () => {
    expect(averageFuelPriceCentsPerLiter(7_200, 0)).toBeNull();
  });
});

describe('consumptionMlPer100Km', () => {
  it('scales litres per km to per 100 km, in millilitres', () => {
    // 45 L over 500 km -> 9 L/100km -> 9000 mL/100km.
    expect(consumptionMlPer100Km(45_000, 500)).toBe(9_000);
  });

  it('is null with no distance', () => {
    expect(consumptionMlPer100Km(45_000, 0)).toBeNull();
  });
});

describe('averageTicketCents', () => {
  it('divides revenue by the service count', () => {
    expect(averageTicketCents(30_000, 4)).toBe(7_500);
  });

  it('is null for an empty set', () => {
    expect(averageTicketCents(0, 0)).toBeNull();
  });
});

describe('efficiencyRatio', () => {
  it('is billable distance over driven distance', () => {
    expect(efficiencyRatio(870, 1_000)).toBe(0.87);
  });

  it('is null with no driven distance', () => {
    expect(efficiencyRatio(870, 0)).toBeNull();
  });
});

describe('estimatedFuelCents', () => {
  it('costs a distance at the standard consumption and price', () => {
    // 500 km at 11 L/100km = 55 L; at 152 c/L = 8360 c.
    expect(estimatedFuelCents(500, 11_000, 152)).toBe(8_360);
  });

  it('is zero for no distance', () => {
    expect(estimatedFuelCents(0, 11_000, 152)).toBe(0);
  });
});

describe('investmentRecovery', () => {
  it('reports progress while still in the red', () => {
    const r = investmentRecovery(100_000, 40_000);
    expect(r.recoveryRatio).toBe(0.4);
    expect(r.outstandingCents).toBe(60_000);
    expect(r.recovered).toBe(false);
  });

  it('reports recovery once profit catches up', () => {
    const r = investmentRecovery(100_000, 120_000);
    expect(r.outstandingCents).toBe(0);
    expect(r.recovered).toBe(true);
  });

  it('has no ratio and is not recovered with nothing invested', () => {
    const r = investmentRecovery(0, 5_000);
    expect(r.recoveryRatio).toBeNull();
    expect(r.recovered).toBe(false);
  });
});
