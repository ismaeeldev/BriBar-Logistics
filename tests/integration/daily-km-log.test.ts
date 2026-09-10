/**
 * The daily-km-log module, end to end (ERP roadmap Phase 5, `00KmDiariosReales`).
 *
 * Admin-only throughout — same reasoning as `refuelling.test.ts` — so the
 * security cases here are simpler than the service workflow's: there is no
 * ownership scoping to prove, only that a driver actor is refused outright.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { dailyKmLogService } from '@/modules/daily-km/service/daily-km-log.service';

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

/** A valid daily-km-log payload; tests override the field under examination. */
function dailyKmLogBody(fixture: Fixture, overrides: Record<string, unknown> = {}) {
  return {
    vehicleId: fixture.vehicleId,
    date: '2026-09-02',
    actualKm: 100,
    ...overrides,
  };
}

describe('creating a daily km log (ERP roadmap Phase 5)', () => {
  it('records it', async () => {
    const created = await dailyKmLogService.create(fixture.admin, dailyKmLogBody(fixture));

    expect(created.actualKm).toBe(100);
    expect(created.date).toBeInstanceOf(Date);
  });

  it('accepts an optional route and driver', async () => {
    const created = await dailyKmLogService.create(
      fixture.admin,
      dailyKmLogBody(fixture, { routeId: fixture.routeId, driverId: fixture.driver.userId }),
    );

    expect(created.routeId).toBe(fixture.routeId);
    expect(created.driverId).toBe(fixture.driver.userId);
  });

  it('stores worked time as whole minutes', async () => {
    // The service layer receives already-parsed input - `workedHours`'s
    // decimal-hours-string-to-minutes conversion is `workedMinutesSchema`'s
    // job (`schemas/daily-km-log.schema.ts`), exercised directly by the unit
    // suite; this proves the service persists the parsed value as given.
    const created = await dailyKmLogService.create(
      fixture.admin,
      dailyKmLogBody(fixture, { workedHours: 510 }),
    );

    expect(created.workedMinutes).toBe(510);
  });

  it('rejects a deactivated vehicle', async () => {
    await expectAppError(
      dailyKmLogService.create(
        fixture.admin,
        dailyKmLogBody(fixture, { vehicleId: fixture.inactiveVehicleId }),
      ),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('rejects a driver who is not a driver', async () => {
    await expectAppError(
      dailyKmLogService.create(
        fixture.admin,
        dailyKmLogBody(fixture, { driverId: fixture.admin.userId }),
      ),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('rejects a second log for the same vehicle on the same day', async () => {
    await dailyKmLogService.create(fixture.admin, dailyKmLogBody(fixture));

    await expect(dailyKmLogService.create(fixture.admin, dailyKmLogBody(fixture))).rejects.toThrow();
  });

  it('records the creation in the audit log', async () => {
    const created = await dailyKmLogService.create(fixture.admin, dailyKmLogBody(fixture));

    const entry = await prisma.auditLog.findFirstOrThrow({ where: { entityId: created.id } });

    expect(entry.action).toBe('CREATE');
    expect(entry.actorUserId).toBe(fixture.admin.userId);
  });

  it('does not let a driver record one', async () => {
    await expectAppError(
      dailyKmLogService.create(fixture.driver, dailyKmLogBody(fixture)),
      'FORBIDDEN',
    );
  });
});

describe('editing a daily km log (ERP roadmap Phase 5)', () => {
  it('records only the changed fields in the audit log', async () => {
    const created = await dailyKmLogService.create(fixture.admin, dailyKmLogBody(fixture));

    await dailyKmLogService.update(fixture.admin, created.id, { actualKm: 150 });

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: created.id, action: 'UPDATE' },
    });

    expect(entry.beforeData).toMatchObject({ actualKm: 100 });
    expect(entry.afterData).toMatchObject({ actualKm: 150 });
  });

  it('does not let a driver edit one', async () => {
    const created = await dailyKmLogService.create(fixture.admin, dailyKmLogBody(fixture));

    await expectAppError(
      dailyKmLogService.update(fixture.driver, created.id, { actualKm: 150 }),
      'FORBIDDEN',
    );
  });
});

describe('deleting a daily km log (ERP roadmap Phase 5)', () => {
  it('lets an administrator delete it', async () => {
    const created = await dailyKmLogService.create(fixture.admin, dailyKmLogBody(fixture));

    await dailyKmLogService.remove(fixture.admin, created.id);

    await expectAppError(dailyKmLogService.getById(fixture.admin, created.id), 'NOT_FOUND');
  });

  it('does not let a driver delete one', async () => {
    const created = await dailyKmLogService.create(fixture.admin, dailyKmLogBody(fixture));

    await expectAppError(
      dailyKmLogService.remove(fixture.driver, created.id),
      'FORBIDDEN',
    );
  });
});
