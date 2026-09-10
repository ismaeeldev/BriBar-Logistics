/**
 * The personnel-cost module, end to end (ERP roadmap Phase 5, `04Personal`).
 *
 * Admin-only throughout — same reasoning as `refuelling.test.ts`.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { personnelCostService } from '@/modules/personnel/service/personnel-cost.service';

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

/** A valid personnel-cost payload; tests override the field under examination. */
function personnelCostBody(fixture: Fixture, overrides: Record<string, unknown> = {}) {
  return {
    userId: fixture.driver.userId,
    year: 2026,
    month: 9,
    base: 150_000, // €1,500.00
    ...overrides,
  };
}

describe('creating a personnel cost (ERP roadmap Phase 5)', () => {
  it('records it, totalling base alone when nothing else is given', async () => {
    const created = await personnelCostService.create(fixture.admin, personnelCostBody(fixture));

    expect(created.baseCents).toBe(150_000);
    expect(created.totalCents).toBe(150_000);
  });

  it('sums base, overtime, allowances and other into the total, server-side', async () => {
    const created = await personnelCostService.create(
      fixture.admin,
      personnelCostBody(fixture, { overtime: 10_000, allowances: 5_000, other: 1_000 }),
    );

    expect(created.totalCents).toBe(166_000);
  });

  it('computes a daily fixed cost from the total and the month length', async () => {
    // September has 30 days.
    const created = await personnelCostService.create(
      fixture.admin,
      personnelCostBody(fixture, { base: 300_000, year: 2026, month: 9 }),
    );

    const detail = await personnelCostService.getById(fixture.admin, created.id);

    expect(detail.dailyFixedCostCents).toBe(10_000);
  });

  it('rejects an unknown user', async () => {
    await expectAppError(
      personnelCostService.create(
        fixture.admin,
        personnelCostBody(fixture, { userId: '00000000-0000-0000-0000-000000000000' }),
      ),
      'NOT_FOUND',
    );
  });

  it('rejects a second cost for the same user/year/month', async () => {
    await personnelCostService.create(fixture.admin, personnelCostBody(fixture));

    await expect(
      personnelCostService.create(fixture.admin, personnelCostBody(fixture)),
    ).rejects.toThrow();
  });

  it('records the creation in the audit log', async () => {
    const created = await personnelCostService.create(fixture.admin, personnelCostBody(fixture));

    const entry = await prisma.auditLog.findFirstOrThrow({ where: { entityId: created.id } });

    expect(entry.action).toBe('CREATE');
    expect(entry.actorUserId).toBe(fixture.admin.userId);
  });

  it('does not let a driver record one', async () => {
    await expectAppError(
      personnelCostService.create(fixture.driver, personnelCostBody(fixture)),
      'FORBIDDEN',
    );
  });
});

describe('editing a personnel cost (ERP roadmap Phase 5)', () => {
  it('recalculates the total only when a component amount changes', async () => {
    const created = await personnelCostService.create(
      fixture.admin,
      personnelCostBody(fixture, { base: 150_000, overtime: 10_000 }),
    );

    const untouched = await personnelCostService.update(fixture.admin, created.id, {
      notes: 'Nota',
    });
    expect(untouched.totalCents).toBe(created.totalCents);

    const recalculated = await personnelCostService.update(fixture.admin, created.id, {
      overtime: 20_000,
    });
    expect(recalculated.totalCents).toBe(170_000);
  });

  it('does not let a driver edit one', async () => {
    const created = await personnelCostService.create(fixture.admin, personnelCostBody(fixture));

    await expectAppError(
      personnelCostService.update(fixture.driver, created.id, { base: 160_000 }),
      'FORBIDDEN',
    );
  });
});

describe('deleting a personnel cost (ERP roadmap Phase 5)', () => {
  it('lets an administrator delete it', async () => {
    const created = await personnelCostService.create(fixture.admin, personnelCostBody(fixture));

    await personnelCostService.remove(fixture.admin, created.id);

    await expectAppError(personnelCostService.getById(fixture.admin, created.id), 'NOT_FOUND');
  });

  it('does not let a driver delete one', async () => {
    const created = await personnelCostService.create(fixture.admin, personnelCostBody(fixture));

    await expectAppError(
      personnelCostService.remove(fixture.driver, created.id),
      'FORBIDDEN',
    );
  });
});
