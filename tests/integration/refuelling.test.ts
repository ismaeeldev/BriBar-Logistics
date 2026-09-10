/**
 * The refuelling module, end to end (ERP roadmap Phase 2).
 *
 * Admin-only throughout — see the doc comment on `Refuelling` in
 * `schema.prisma` — so the security cases here are simpler than the service
 * workflow's: there is no ownership scoping to prove, only that a driver
 * actor is refused outright.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { lookupService } from '@/modules/lookup/service/lookup.service';
import { refuellingService } from '@/modules/refuelling/service/refuelling.service';

import { prisma, seedFixture, type Fixture } from './helpers';

let fixture: Fixture;

beforeEach(async () => {
  fixture = await seedFixture();
});

async function expectAppError(promise: Promise<unknown>, code: string): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    return error as AppError;
  }
  throw new Error(`Expected the call to fail with ${code}, but it resolved.`);
}

/** A valid refuelling payload; tests override the field under examination. */
function refuellingBody(fixture: Fixture, overrides: Record<string, unknown> = {}) {
  return {
    vehicleId: fixture.vehicleId,
    driverId: fixture.driver.userId,
    odometerKm: 10_000,
    liters: 45_000,
    total: 7_200, // €72.00
    vatRate: 'STANDARD' as const,
    ...overrides,
  };
}

describe('creating a refuelling (ERP roadmap Phase 2)', () => {
  it('records it, allocating a sequential refuel code', async () => {
    const first = await refuellingService.create(fixture.admin, refuellingBody(fixture));
    const second = await refuellingService.create(fixture.admin, refuellingBody(fixture));

    expect(first.refuelCode).toBe('R000001');
    expect(second.refuelCode).toBe('R000002');
  });

  it('sets the business date server-side', async () => {
    const created = await refuellingService.create(fixture.admin, refuellingBody(fixture));

    expect(created.refuelDate).toBeInstanceOf(Date);
  });

  it('splits the total into base and VAT so they always sum back to it', async () => {
    // €72.00 at 21% -> base = 72.00/1.21 = 59.5041... -> 5950 cents.
    const created = await refuellingService.create(
      fixture.admin,
      refuellingBody(fixture, { total: 7_200, vatRate: 'STANDARD' }),
    );

    expect(created.baseCents + created.vatCents).toBe(created.totalCents);
    expect(created.baseCents).toBe(5_950);
    expect(created.vatCents).toBe(1_250);
  });

  it('splits correctly at every VAT rate, including exempt', async () => {
    for (const vatRate of ['STANDARD', 'REDUCED', 'SUPER_REDUCED', 'ZERO', 'EXEMPT'] as const) {
      const created = await refuellingService.create(
        fixture.admin,
        refuellingBody(fixture, { total: 10_000, vatRate }),
      );
      expect(created.baseCents + created.vatCents).toBe(10_000);
    }
  });

  it('rejects a deactivated vehicle', async () => {
    await expectAppError(
      refuellingService.create(
        fixture.admin,
        refuellingBody(fixture, { vehicleId: fixture.inactiveVehicleId }),
      ),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('rejects a driver who is not a driver', async () => {
    await expectAppError(
      refuellingService.create(
        fixture.admin,
        refuellingBody(fixture, { driverId: fixture.admin.userId }),
      ),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('accepts an optional fuel type/gas station/payment method of the right kind', async () => {
    const fuelType = await lookupService.create(fixture.admin, 'FUEL_TYPE', {
      name: 'Diésel',
      isActive: true,
    });

    const created = await refuellingService.create(
      fixture.admin,
      refuellingBody(fixture, { fuelTypeId: fuelType.id }),
    );

    expect(created.fuelTypeId).toBe(fuelType.id);
  });

  it('rejects a lookup id from the wrong kind', async () => {
    const paymentMethod = await lookupService.create(fixture.admin, 'PAYMENT_METHOD', {
      name: 'Tarjeta',
      isActive: true,
    });

    await expectAppError(
      refuellingService.create(
        fixture.admin,
        // A payment method's id, offered as the fuel type.
        refuellingBody(fixture, { fuelTypeId: paymentMethod.id }),
      ),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('records the creation in the audit log', async () => {
    const created = await refuellingService.create(fixture.admin, refuellingBody(fixture));

    const entry = await prisma.auditLog.findFirstOrThrow({ where: { entityId: created.id } });

    expect(entry.action).toBe('CREATE');
    expect(entry.actorUserId).toBe(fixture.admin.userId);
  });

  it('does not let a driver record one', async () => {
    await expectAppError(
      refuellingService.create(fixture.driver, refuellingBody(fixture)),
      'FORBIDDEN',
    );
  });
});

describe('km since last refuel and consumption (ERP roadmap Phase 2)', () => {
  it('has no previous data on a vehicle first refuel', async () => {
    const created = await refuellingService.create(fixture.admin, refuellingBody(fixture));
    const detail = await refuellingService.getById(fixture.admin, created.id);

    expect(detail.kmSinceLastRefuel).toBeNull();
    expect(detail.consumptionMlPer100Km).toBeNull();
  });

  it('computes both from the previous refuel for the same vehicle', async () => {
    await refuellingService.create(
      fixture.admin,
      refuellingBody(fixture, { odometerKm: 10_000, liters: 40_000 }),
    );
    const second = await refuellingService.create(
      fixture.admin,
      refuellingBody(fixture, { odometerKm: 10_500, liters: 45_000 }),
    );

    const detail = await refuellingService.getById(fixture.admin, second.id);

    expect(detail.kmSinceLastRefuel).toBe(500);
    // 45 L over 500 km -> 9 L/100km -> 9000 mL/100km.
    expect(detail.consumptionMlPer100Km).toBe(9_000);
  });

  it('does not mix figures across two different vehicles', async () => {
    await refuellingService.create(
      fixture.admin,
      refuellingBody(fixture, { vehicleId: fixture.vehicleId, odometerKm: 10_000 }),
    );
    const otherVehicleRefuel = await refuellingService.create(
      fixture.admin,
      refuellingBody(fixture, { vehicleId: fixture.spareVehicleId, odometerKm: 500 }),
    );

    const detail = await refuellingService.getById(fixture.admin, otherVehicleRefuel.id);

    expect(detail.kmSinceLastRefuel).toBeNull();
  });
});

describe('editing a refuelling (ERP roadmap Phase 2)', () => {
  it('recalculates base/VAT only when the total or the rate changes', async () => {
    const created = await refuellingService.create(
      fixture.admin,
      refuellingBody(fixture, { total: 10_000, vatRate: 'STANDARD' }),
    );

    const untouched = await refuellingService.update(fixture.admin, created.id, {
      odometerKm: 10_050,
    });
    expect(untouched.baseCents).toBe(created.baseCents);
    expect(untouched.vatCents).toBe(created.vatCents);

    const recalculated = await refuellingService.update(fixture.admin, created.id, {
      total: 12_100,
    });
    expect(recalculated.baseCents + recalculated.vatCents).toBe(12_100);
    expect(recalculated.baseCents).not.toBe(created.baseCents);
  });

  it('records only the changed fields in the audit log', async () => {
    const created = await refuellingService.create(fixture.admin, refuellingBody(fixture));

    await refuellingService.update(fixture.admin, created.id, { odometerKm: 10_100 });

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: created.id, action: 'UPDATE' },
    });

    expect(entry.beforeData).toMatchObject({ odometerKm: 10_000 });
    expect(entry.afterData).toMatchObject({ odometerKm: 10_100 });
  });

  it('does not let a driver edit one', async () => {
    const created = await refuellingService.create(fixture.admin, refuellingBody(fixture));

    await expectAppError(
      refuellingService.update(fixture.driver, created.id, { odometerKm: 10_100 }),
      'FORBIDDEN',
    );
  });
});

describe('deleting a refuelling (ERP roadmap Phase 2)', () => {
  it('lets an administrator delete it', async () => {
    const created = await refuellingService.create(fixture.admin, refuellingBody(fixture));

    await refuellingService.remove(fixture.admin, created.id);

    await expectAppError(refuellingService.getById(fixture.admin, created.id), 'NOT_FOUND');
  });

  it('records the deletion in the audit log', async () => {
    const created = await refuellingService.create(fixture.admin, refuellingBody(fixture));
    await refuellingService.remove(fixture.admin, created.id);

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: created.id, action: 'DELETE' },
    });

    expect(entry.actorUserId).toBe(fixture.admin.userId);
  });

  it('does not let a driver delete one', async () => {
    const created = await refuellingService.create(fixture.admin, refuellingBody(fixture));

    await expectAppError(
      refuellingService.remove(fixture.driver, created.id),
      'FORBIDDEN',
    );
  });
});
