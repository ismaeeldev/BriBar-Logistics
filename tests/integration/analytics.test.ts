/**
 * The analytics layer, end to end (ERP roadmap Phase 6, roadmap §3.4).
 *
 * Admin-only and entirely derived — the arithmetic is proved in isolation by
 * `tests/unit/analytics-math.test.ts`; what this file proves is that
 * `analyticsService` fetches the right rows, buckets them by the right
 * period / vehicle / contract / driver, and refuses a non-admin.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { analyticsService } from '@/modules/analytics/service/analytics.service';

import { prisma, seedFixture, type Fixture } from './helpers';

let fixture: Fixture;

beforeEach(async () => {
  fixture = await seedFixture();
});

async function expectAppError(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    return;
  }
  throw new Error(`Expected the call to fail with ${code}, but it resolved.`);
}

/** A service row with a billable base, inserted straight into the table. */
async function seedService(
  overrides: {
    serviceDate: string;
    vehicleId?: string;
    driverId?: string;
    routeId?: string;
    serviceKm?: number;
    baseCents?: number | null;
    code?: string;
  },
) {
  const serviceKm = overrides.serviceKm ?? 100;
  return prisma.service.create({
    data: {
      serviceCode: overrides.code ?? `S-${Math.floor(Math.random() * 1e9)}`,
      serviceDate: new Date(`${overrides.serviceDate}T00:00:00.000Z`),
      driverId: overrides.driverId ?? fixture.driver.userId,
      vehicleId: overrides.vehicleId ?? fixture.vehicleId,
      routeId: overrides.routeId ?? fixture.routeId,
      originSnapshot: 'A',
      destinationSnapshot: 'B',
      rateCents: overrides.baseCents === null ? null : (overrides.baseCents ?? 50_000),
      baseCents: overrides.baseCents === null ? null : (overrides.baseCents ?? 50_000),
      startDashboardKm: 10_000,
      startBaseKm: 10_010,
      endBaseKm: 10_010 + serviceKm,
      endDashboardKm: 10_020 + serviceKm,
      actualKm: serviceKm + 20,
      serviceKm,
      departureTime: new Date('1970-01-01T07:00:00.000Z'),
      arrivalTime: new Date('1970-01-01T15:00:00.000Z'),
      // Analytics counts every priced service regardless of status (a closed
      // month's are all approved anyway); left pending here to avoid seeding
      // approval metadata the `services_approval_metadata_consistent` CHECK
      // would otherwise require.
      status: 'PENDING_APPROVAL',
    },
  });
}

function baseFromGross(totalCents: number): number {
  return Math.round((totalCents * 100) / 121);
}

async function seedRefuelling(overrides: {
  refuelDate: string;
  vehicleId?: string;
  totalCents?: number;
  litersMl?: number;
  odometerKm?: number;
  code?: string;
}) {
  const totalCents = overrides.totalCents ?? 12_100;
  return prisma.refuelling.create({
    data: {
      refuelCode: overrides.code ?? `R-${Math.floor(Math.random() * 1e9)}`,
      vehicleId: overrides.vehicleId ?? fixture.vehicleId,
      driverId: fixture.driver.userId,
      refuelDate: new Date(`${overrides.refuelDate}T00:00:00.000Z`),
      odometerKm: overrides.odometerKm ?? 10_000,
      litersMl: overrides.litersMl ?? 50_000,
      totalCents,
      vatRate: 'STANDARD',
      baseCents: baseFromGross(totalCents),
      vatCents: totalCents - baseFromGross(totalCents),
    },
  });
}

async function seedInvestmentCategory(expenseType: 'OPERATION' | 'INVESTMENT') {
  const supplier = await prisma.supplier.create({
    data: { name: `Sup ${Math.random()}` },
  });
  const category = await prisma.expenseCategory.create({
    data: { name: `Cat ${Math.random()}`, expenseType, defaultVatRate: 'STANDARD' },
  });
  return { supplierId: supplier.id, categoryId: category.id };
}

async function seedReceivedInvoice(overrides: {
  invoiceDate: string;
  vehicleId?: string | null;
  totalCents?: number;
  expenseType: 'OPERATION' | 'INVESTMENT';
  code?: string;
}) {
  const { supplierId, categoryId } = await seedInvestmentCategory(overrides.expenseType);
  const totalCents = overrides.totalCents ?? 24_200;
  return prisma.receivedInvoice.create({
    data: {
      invoiceCode: overrides.code ?? `FR-${Math.floor(Math.random() * 1e9)}`,
      supplierId,
      categoryId,
      vehicleId: overrides.vehicleId ?? fixture.vehicleId,
      invoiceDate: new Date(`${overrides.invoiceDate}T00:00:00.000Z`),
      baseCents: Math.round((totalCents * 100) / 121),
      vatRate: 'STANDARD',
      vatCents: totalCents - Math.round((totalCents * 100) / 121),
      totalCents,
      concept: 'Factura',
    },
  });
}

describe('analytics overview (ERP roadmap Phase 6)', () => {
  it('sums revenue, fuel (base imponible, not VAT-inclusive) and operating expense into the operating margin', async () => {
    await seedService({ serviceDate: '2026-03-10', baseCents: 100_000, serviceKm: 200 });
    await seedRefuelling({ refuelDate: '2026-03-12', totalCents: 20_000 });
    await seedReceivedInvoice({
      invoiceDate: '2026-03-15',
      totalCents: 10_000,
      expenseType: 'OPERATION',
    });
    await prisma.personnelCost.create({
      data: {
        userId: fixture.driver.userId,
        year: 2026,
        month: 3,
        baseCents: 30_000,
        totalCents: 30_000,
      },
    });

    const overview = await analyticsService.overview(fixture.admin, {});
    const fuelBaseCents = baseFromGross(20_000);

    expect(overview.revenueCents).toBe(100_000);
    // Client decision 2026-09-13: fuel cost is "base imponible", not the
    // VAT-inclusive total actually paid at the pump.
    expect(overview.fuelCents).toBe(fuelBaseCents);
    expect(overview.operatingExpenseCents).toBe(10_000);
    expect(overview.personnelCents).toBe(30_000);
    const expectedMargin = 100_000 - fuelBaseCents - 30_000 - 10_000;
    expect(overview.marginCents).toBe(expectedMargin);
    expect(overview.marginRatio).toBeCloseTo(expectedMargin / 100_000);
  });

  it('uses the VAT-inclusive total for the average pump price, unlike the fuel cost aggregate', async () => {
    await seedRefuelling({
      refuelDate: '2026-06-01',
      totalCents: 12_100,
      litersMl: 10_000,
    });

    const overview = await analyticsService.overview(fixture.admin, {});

    // 121.00 EUR / 10 L = 12.10 EUR/L = 1210 cents/L, using the gross total.
    expect(overview.avgFuelPriceCentsPerLiter).toBe(1_210);
  });

  it('scopes revenue, fuel and margin to one vehicle, and drops personnel cost from both (client decision 2026-09-13)', async () => {
    await seedService({ serviceDate: '2026-03-10', vehicleId: fixture.vehicleId, baseCents: 80_000 });
    await seedService({
      serviceDate: '2026-03-11',
      vehicleId: fixture.spareVehicleId,
      baseCents: 20_000,
      code: 'S-spare',
    });
    await seedRefuelling({ refuelDate: '2026-03-12', vehicleId: fixture.vehicleId, totalCents: 12_100 });
    await prisma.personnelCost.create({
      data: { userId: fixture.driver.userId, year: 2026, month: 3, baseCents: 30_000, totalCents: 30_000 },
    });

    const scoped = await analyticsService.overview(fixture.admin, { vehicleId: fixture.vehicleId });
    const fuelBaseCents = baseFromGross(12_100);

    expect(scoped.revenueCents).toBe(80_000);
    expect(scoped.fuelCents).toBe(fuelBaseCents);
    expect(scoped.personnelCents).toBe(0);
    expect(scoped.marginCents).toBe(80_000 - fuelBaseCents);
    expect(scoped.filter.vehicleId).toBe(fixture.vehicleId);
  });

  it('computes average consumption from the odometer distance since each refuel\'s previous fill, not a separate km log total', async () => {
    // Outside the filtered period (March), but still needed as the baseline
    // odometer reading the April fill's distance is measured from.
    await seedRefuelling({
      refuelDate: '2026-03-20',
      odometerKm: 10_000,
      litersMl: 40_000,
      code: 'R-first',
    });
    // The only fill inside the filtered period: 200 km since the March fill
    // (10_200 - 10_000), 30 L.
    await seedRefuelling({
      refuelDate: '2026-04-15',
      odometerKm: 10_200,
      litersMl: 30_000,
      code: 'R-second',
    });
    // A daily-km log in the same period, deliberately different from the
    // odometer delta above - it must not be what the ratio is based on.
    await prisma.dailyKmLog.create({
      data: {
        vehicleId: fixture.vehicleId,
        routeId: fixture.routeId,
        driverId: fixture.driver.userId,
        date: new Date('2026-04-10T00:00:00.000Z'),
        actualKm: 999,
      },
    });

    const overview = await analyticsService.overview(fixture.admin, { year: 2026, month: 4 });

    // 30 L over 200 km -> 15 L/100km -> 15_000 mL/100km.
    expect(overview.avgConsumptionMlPer100Km).toBe(15_000);
  });

  it('restricts to the requested year and month', async () => {
    await seedService({ serviceDate: '2026-01-10', baseCents: 40_000 });
    await seedService({ serviceDate: '2026-02-10', baseCents: 60_000 });

    const january = await analyticsService.overview(fixture.admin, { year: 2026, month: 1 });
    const wholeYear = await analyticsService.overview(fixture.admin, { year: 2026 });

    expect(january.revenueCents).toBe(40_000);
    expect(wholeYear.revenueCents).toBe(100_000);
  });

  it('keeps an investment out of operating expense but counts it separately', async () => {
    await seedReceivedInvoice({
      invoiceDate: '2026-04-01',
      totalCents: 500_000, 
      expenseType: 'INVESTMENT',
    });

    const overview = await analyticsService.overview(fixture.admin, {});

    expect(overview.operatingExpenseCents).toBe(0);
    expect(overview.investmentCents).toBe(500_000);
  });

  it('ignores a service that has no rate', async () => {
    await seedService({ serviceDate: '2026-05-10', baseCents: null });

    const overview = await analyticsService.overview(fixture.admin, {});

    expect(overview.revenueCents).toBe(0);
    expect(overview.serviceCount).toBe(1);
  });

  it('refuses a non-admin', async () => {
    await expectAppError(analyticsService.overview(fixture.driver, {}), 'FORBIDDEN');
  });
});


describe('investment recovery (ERP roadmap Phase 6)', () => {
  it('measures cumulative profit against a vehicle investment', async () => {
    await seedReceivedInvoice({
      invoiceDate: '2026-01-01',
      vehicleId: fixture.vehicleId,
      totalCents: 100_000,  
      expenseType: 'INVESTMENT',
    });
    await seedService({ serviceDate: '2026-02-01', vehicleId: fixture.vehicleId, baseCents: 40_000 });

    const rows = await analyticsService.investmentRecovery(fixture.admin);
    const row = rows.find((r) => r.vehicleId === fixture.vehicleId);

    expect(row?.investmentCents).toBe(100_000);
    expect(row?.cumulativeProfitCents).toBe(40_000);
    expect(row?.recovered).toBe(false);
    expect(row?.outstandingCents).toBe(60_000);
  });

  it('is all-time and ignores the period filter entirely', async () => {
    await seedReceivedInvoice({
      invoiceDate: '2020-01-01',
      vehicleId: fixture.vehicleId,
      totalCents: 100_000, 
      expenseType: 'INVESTMENT',
    });

    const rows = await analyticsService.investmentRecovery(fixture.admin);

    expect(rows.some((r) => r.vehicleId === fixture.vehicleId)).toBe(true);
  });

  it('deducts fuel at base imponible, not the VAT-inclusive total, from cumulative profit', async () => {
    await seedReceivedInvoice({
      invoiceDate: '2026-01-01',
      vehicleId: fixture.vehicleId,
      totalCents: 100_000, 
      expenseType: 'INVESTMENT',
    });
    await seedService({ serviceDate: '2026-02-01', vehicleId: fixture.vehicleId, baseCents: 40_000 });
    await seedRefuelling({ refuelDate: '2026-02-02', vehicleId: fixture.vehicleId, totalCents: 12_100 });

    const rows = await analyticsService.investmentRecovery(fixture.admin);
    const row = rows.find((r) => r.vehicleId === fixture.vehicleId);

    expect(row?.cumulativeProfitCents).toBe(40_000 - baseFromGross(12_100));
  });
});

describe('monthly margin trend (ERP roadmap Phase 6)', () => {
  it('returns one row per active month, oldest first', async () => {
    await seedService({ serviceDate: '2026-02-10', baseCents: 50_000 });
    await seedService({ serviceDate: '2026-01-10', baseCents: 30_000, code: 'S-jan' });

    const rows = await analyticsService.monthlyMargin(fixture.admin);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ year: 2026, month: 1 });
    expect(rows[1]).toMatchObject({ year: 2026, month: 2 });
  });

  it('uses base imponible, not the VAT-inclusive total, for fuel cost (client decision 2026-09-13)', async () => {
    await seedRefuelling({ refuelDate: '2026-03-05', totalCents: 20_000 });

    const rows = await analyticsService.monthlyMargin(fixture.admin);
    const march = rows.find((r) => r.year === 2026 && r.month === 3);

    expect(march?.fuelCents).toBe(baseFromGross(20_000));
  });
});
