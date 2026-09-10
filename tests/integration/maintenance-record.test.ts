/**
 * The maintenance module, end to end (ERP roadmap Phase 5, `05Mantenimiento`).
 *
 * Admin-only throughout — same reasoning as `refuelling.test.ts`. The urgency
 * banding itself is proved against every input combination by the unit suite
 * (`tests/unit/maintenance-urgency.test.ts`); what this file proves is that
 * the service wires the right numbers into it — the record's own
 * `nextDueKm`/`nextDueDate` and the vehicle's current odometer, synthesised
 * from whichever of `Refuelling`/`DailyKmLog` is more recent.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { dailyKmLogService } from '@/modules/daily-km/service/daily-km-log.service';
import { lookupService } from '@/modules/lookup/service/lookup.service';
import { maintenanceRecordService } from '@/modules/maintenance/service/maintenance-record.service';
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

async function createMaintenanceType(fixture: Fixture, name = 'Cambio de aceite') {
  return lookupService.create(fixture.admin, 'MAINTENANCE_TYPE', { name, isActive: true });
}

/** A valid maintenance-record payload; tests override the field under examination. */
function maintenanceRecordBody(
  fixture: Fixture,
  maintenanceTypeId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    vehicleId: fixture.vehicleId,
    maintenanceTypeId,
    performedDate: '2026-09-02',
    ...overrides,
  };
}

describe('creating a maintenance record (ERP roadmap Phase 5)', () => {
  it('records it, allocating a sequential maintenance code', async () => {
    const type = await createMaintenanceType(fixture);

    const first = await maintenanceRecordService.create(
      fixture.admin,
      maintenanceRecordBody(fixture, type.id),
    );
    const second = await maintenanceRecordService.create(
      fixture.admin,
      maintenanceRecordBody(fixture, type.id),
    );

    expect(first.maintenanceCode).toBe('MT000001');
    expect(second.maintenanceCode).toBe('MT000002');
  });

  it('rejects a deactivated vehicle', async () => {
    const type = await createMaintenanceType(fixture);

    await expectAppError(
      maintenanceRecordService.create(
        fixture.admin,
        maintenanceRecordBody(fixture, type.id, { vehicleId: fixture.inactiveVehicleId }),
      ),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('rejects a lookup id from the wrong kind', async () => {
    const paymentMethod = await lookupService.create(fixture.admin, 'PAYMENT_METHOD', {
      name: 'Tarjeta',
      isActive: true,
    });

    await expectAppError(
      maintenanceRecordService.create(
        fixture.admin,
        maintenanceRecordBody(fixture, paymentMethod.id),
      ),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('records the creation in the audit log', async () => {
    const type = await createMaintenanceType(fixture);
    const created = await maintenanceRecordService.create(
      fixture.admin,
      maintenanceRecordBody(fixture, type.id),
    );

    const entry = await prisma.auditLog.findFirstOrThrow({ where: { entityId: created.id } });

    expect(entry.action).toBe('CREATE');
    expect(entry.actorUserId).toBe(fixture.admin.userId);
  });

  it('does not let a driver record one', async () => {
    const type = await createMaintenanceType(fixture);

    await expectAppError(
      maintenanceRecordService.create(fixture.driver, maintenanceRecordBody(fixture, type.id)),
      'FORBIDDEN',
    );
  });
});

describe('maintenance urgency (ERP roadmap Phase 5)', () => {
  it('is unknown with neither a next-due km nor date', async () => {
    const type = await createMaintenanceType(fixture);
    const created = await maintenanceRecordService.create(
      fixture.admin,
      maintenanceRecordBody(fixture, type.id),
    );

    const detail = await maintenanceRecordService.getById(fixture.admin, created.id);

    expect(detail.urgency).toBe('UNKNOWN');
  });

  it('is OK when the next-due date is comfortably in the future', async () => {
    const type = await createMaintenanceType(fixture);
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 120);

    const created = await maintenanceRecordService.create(
      fixture.admin,
      maintenanceRecordBody(fixture, type.id, {
        nextDueDate: farFuture.toISOString().slice(0, 10),
      }),
    );

    const detail = await maintenanceRecordService.getById(fixture.admin, created.id);

    expect(detail.urgency).toBe('OK');
  });

  it('is urgent when the next-due date has already passed', async () => {
    const type = await createMaintenanceType(fixture);
    const past = new Date();
    past.setDate(past.getDate() - 5);

    const created = await maintenanceRecordService.create(
      fixture.admin,
      maintenanceRecordBody(fixture, type.id, { nextDueDate: past.toISOString().slice(0, 10) }),
    );

    const detail = await maintenanceRecordService.getById(fixture.admin, created.id);

    expect(detail.urgency).toBe('URGENT');
  });

  it('reads the current odometer from the vehicle\'s most recent daily km log', async () => {
    const type = await createMaintenanceType(fixture);

    await dailyKmLogService.create(fixture.admin, {
      vehicleId: fixture.vehicleId,
      date: new Date().toISOString().slice(0, 10),
      actualKm: 99_800,
    });

    const created = await maintenanceRecordService.create(
      fixture.admin,
      maintenanceRecordBody(fixture, type.id, { nextDueKm: 100_000 }),
    );

    const detail = await maintenanceRecordService.getById(fixture.admin, created.id);

    // 100_000 - 99_800 = 200 km remaining -> within URGENT_KM_THRESHOLD (500).
    expect(detail.urgency).toBe('URGENT');
  });

  it('reads the current odometer from the vehicle\'s most recent refuelling', async () => {
    const type = await createMaintenanceType(fixture);

    await refuellingService.create(fixture.admin, {
      vehicleId: fixture.vehicleId,
      driverId: fixture.driver.userId,
      odometerKm: 98_500,
      liters: 45_000,
      total: 7_200,
      vatRate: 'STANDARD',
    });

    const created = await maintenanceRecordService.create(
      fixture.admin,
      maintenanceRecordBody(fixture, type.id, { nextDueKm: 100_000 }),
    );

    const detail = await maintenanceRecordService.getById(fixture.admin, created.id);

    // 100_000 - 98_500 = 1_500 km remaining -> within UPCOMING_KM_THRESHOLD (2000)
    // but past URGENT_KM_THRESHOLD (500).
    expect(detail.urgency).toBe('UPCOMING');
  });
});

describe('the due summary (ERP roadmap Phase 5)', () => {
  it('excludes records with neither a next-due km nor date', async () => {
    const type = await createMaintenanceType(fixture);
    await maintenanceRecordService.create(fixture.admin, maintenanceRecordBody(fixture, type.id));

    const summary = await maintenanceRecordService.dueSummary(fixture.admin);

    expect(summary).toHaveLength(0);
  });

  it('sorts the most urgent record first', async () => {
    const type = await createMaintenanceType(fixture);
    const soon = new Date();
    soon.setDate(soon.getDate() + 10);
    const far = new Date();
    far.setDate(far.getDate() + 200);

    await maintenanceRecordService.create(
      fixture.admin,
      maintenanceRecordBody(fixture, type.id, {
        vehicleId: fixture.spareVehicleId,
        nextDueDate: far.toISOString().slice(0, 10),
      }),
    );
    const urgent = await maintenanceRecordService.create(
      fixture.admin,
      maintenanceRecordBody(fixture, type.id, {
        vehicleId: fixture.vehicleId,
        nextDueDate: soon.toISOString().slice(0, 10),
      }),
    );

    const summary = await maintenanceRecordService.dueSummary(fixture.admin);

    expect(summary[0]?.id).toBe(urgent.id);
    expect(summary[0]?.urgency).toBe('URGENT');
  });

  it('does not let a driver read it', async () => {
    await expectAppError(maintenanceRecordService.dueSummary(fixture.driver), 'FORBIDDEN');
  });
});

describe('editing a maintenance record (ERP roadmap Phase 5)', () => {
  it('records only the changed fields in the audit log', async () => {
    const type = await createMaintenanceType(fixture);
    const created = await maintenanceRecordService.create(
      fixture.admin,
      maintenanceRecordBody(fixture, type.id),
    );

    await maintenanceRecordService.update(fixture.admin, created.id, { performedKm: 50_000 });

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: created.id, action: 'UPDATE' },
    });

    expect(entry.afterData).toMatchObject({ performedKm: 50_000 });
  });

  it('does not let a driver edit one', async () => {
    const type = await createMaintenanceType(fixture);
    const created = await maintenanceRecordService.create(
      fixture.admin,
      maintenanceRecordBody(fixture, type.id),
    );

    await expectAppError(
      maintenanceRecordService.update(fixture.driver, created.id, { performedKm: 50_000 }),
      'FORBIDDEN',
    );
  });
});

describe('deleting a maintenance record (ERP roadmap Phase 5)', () => {
  it('lets an administrator delete it', async () => {
    const type = await createMaintenanceType(fixture);
    const created = await maintenanceRecordService.create(
      fixture.admin,
      maintenanceRecordBody(fixture, type.id),
    );

    await maintenanceRecordService.remove(fixture.admin, created.id);

    await expectAppError(
      maintenanceRecordService.getById(fixture.admin, created.id),
      'NOT_FOUND',
    );
  });

  it('does not let a driver delete one', async () => {
    const type = await createMaintenanceType(fixture);
    const created = await maintenanceRecordService.create(
      fixture.admin,
      maintenanceRecordBody(fixture, type.id),
    );

    await expectAppError(
      maintenanceRecordService.remove(fixture.driver, created.id),
      'FORBIDDEN',
    );
  });
});
