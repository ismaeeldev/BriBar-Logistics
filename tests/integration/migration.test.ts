/**
 * The one-time ERP import, end to end (ERP roadmap Phase 7, roadmap §3.5).
 *
 * Proves the engine, not every column mapping: dry-run writes nothing, a
 * clean bundle commits in dependency order, a re-run is fully idempotent, and
 * a bundle with an unresolved reference is refused whole.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { migrationService } from '@/modules/migration/service/migration.service';
import { summarize } from '@/modules/migration/domain/import-plan';

import { prisma, seedFixture, type Fixture } from './helpers';

let fixture: Fixture;

beforeEach(async () => {
  fixture = await seedFixture();
});

/** A small but cross-referential bundle: master data plus one of each log. */
function bundle() {
  return {
    'lookup:MAINTENANCE_TYPE': [{ name: 'Cambio de aceite' }],
    tblClientes: [{ name: 'Transportes Delta', taxId: 'B12345678' }],
    tblProveedores: [{ name: 'Taller Central SL' }],
    tblCategoriasGasto: [{ name: 'Reparaciones', expenseType: 'OPERATION' }],
    tblVehiculos: [{ registrationPlate: 'IMP 001', referenceName: 'Camión importado' }],
    tblContratos: [
      {
        code: 'IMP-RUTA-1',
        name: 'Ruta importada',
        origin: 'Madrid',
        destination: 'Bilbao',
        defaultRate: '900.00',
        client: 'Transportes Delta',
      },
    ],
    tblPersonal: [
      { employee: 'Ana García', year: '2026', month: '3', base: '1800.00', overtime: '120.00' },
    ],
    tblKmReales: [
      { vehicle: 'IMP 001', contract: 'IMP-RUTA-1', date: '2026-03-04', actualKm: '420' },
    ],
    tblMantenimientos: [
      { vehicle: 'IMP 001', type: 'Cambio de aceite', performedDate: '2026-03-04', performedKm: '90000' },
    ],
    config: [{ oilChangeIntervalKm: '20000', defaultConsumption: '30', defaultFuelPrice: '1.60' }],
  };
}

describe('dry run (ERP roadmap Phase 7)', () => {
  it('plans every row and writes nothing', async () => {
    const result = await migrationService.run(fixture.admin, bundle(), { commit: false });

    expect(result.committed).toBe(false);
    const summary = summarize(result.plan);
    expect(summary.totals.create).toBeGreaterThan(5);
    expect(summary.totals.error).toBe(0);

    expect(await prisma.client.count()).toBe(0);
    expect(await prisma.dailyKmLog.count()).toBe(0);
  });

  it('refuses a non-admin', async () => {
    await expect(
      migrationService.run(fixture.driver, bundle(), { commit: false }),
    ).rejects.toThrow();
  });
});

describe('commit (ERP roadmap Phase 7)', () => {
  it('writes master data and the logs that reference it', async () => {
    const result = await migrationService.run(fixture.admin, bundle(), { commit: true });

    expect(result.committed).toBe(true);
    expect(result.config.applied).toBe(true);

    const client = await prisma.client.findFirst({ where: { name: 'Transportes Delta' } });
    expect(client).not.toBeNull();

    const route = await prisma.route.findFirst({ where: { code: 'IMP-RUTA-1' } });
    expect(route?.clientId).toBe(client!.id);
    expect(route?.defaultRateCents).toBe(90_000);

    const kmLog = await prisma.dailyKmLog.findFirst({ include: { vehicle: true, route: true } });
    expect(kmLog?.actualKm).toBe(420);
    expect(kmLog?.vehicle.registrationPlate).toBe('IMP 001');
    expect(kmLog?.route?.code).toBe('IMP-RUTA-1');

    const cost = await prisma.personnelCost.findFirst({ orderBy: { createdAt: 'desc' } });
    expect(cost?.totalCents).toBe(192_000);

    expect(await prisma.maintenanceRecord.count()).toBe(1);

    const config = await prisma.appConfig.findFirstOrThrow();
    expect(config.oilChangeIntervalKm).toBe(20_000);
  });

  it('is idempotent — a second run skips everything', async () => {
    await migrationService.run(fixture.admin, bundle(), { commit: true });
    const second = await migrationService.run(fixture.admin, bundle(), { commit: true });

    const summary = summarize(second.plan);
    expect(summary.totals.create).toBe(0);
    expect(summary.totals.skip).toBeGreaterThan(5);

    expect(await prisma.client.count()).toBe(1);
    expect(await prisma.dailyKmLog.count()).toBe(1);
    expect(await prisma.maintenanceRecord.count()).toBe(1);
  });

  it('refuses the whole bundle when a reference does not resolve', async () => {
    const broken = bundle();
    broken.tblKmReales[0]!.vehicle = 'Vehículo Fantasma';

    const result = await migrationService.run(fixture.admin, broken, { commit: true });

    expect(result.committed).toBe(false);
    const summary = summarize(result.plan);
    expect(summary.totals.error).toBe(1);
    // Nothing was written, not even the rows that would have planned cleanly.
    expect(await prisma.client.count()).toBe(0);
  });
});
