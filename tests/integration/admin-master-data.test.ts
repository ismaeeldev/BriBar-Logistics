/**
 * Master-data administration (SRS 26.5) and the permissions matrix (SRS 20).
 *
 * SRS 26.5 lists nine master-data behaviours to test; each has a case below.
 * The permission rows are asserted against the service layer directly, because
 * SRS 11.5 makes the boundary an authorisation rule rather than a UI state — a
 * test that only checked which buttons render would prove nothing.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { clientService } from '@/modules/clients/service/client.service';
import { configService } from '@/modules/config/service/config.service';
import { expenseCategoryService } from '@/modules/expense-categories/service/expense-category.service';
import { lookupService } from '@/modules/lookup/service/lookup.service';
import { routeService } from '@/modules/routes/service/route.service';
import { supplierService } from '@/modules/suppliers/service/supplier.service';
import { serviceService } from '@/modules/services/service/service.service';
import { userService } from '@/modules/users/service/user.service';
import { vehicleService } from '@/modules/vehicles/service/vehicle.service';

import { prisma, seedFixture, serviceBody, type Fixture } from './helpers';

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

describe('vehicles (SRS 13, 26.5)', () => {
  it('lets an administrator create, edit and deactivate', async () => {
    const created = await vehicleService.create(fixture.admin, {
      registrationPlate: '4321 XYZ',
      isActive: true,
    });
    expect(created.registrationPlate).toBe('4321 XYZ');

    const renamed = await vehicleService.update(fixture.admin, created.id, {
      referenceName: 'Unidad 3',
    });
    expect(renamed.referenceName).toBe('Unidad 3');

    const deactivated = await vehicleService.update(fixture.admin, created.id, {
      isActive: false,
    });
    expect(deactivated.isActive).toBe(false);
  });

  it('makes an inactive vehicle unavailable for a new service', async () => {
    await expectAppError(
      serviceService.create(
        fixture.driver,
        serviceBody(fixture, { vehicleId: fixture.inactiveVehicleId }),
      ),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('keeps a historical service related to a deactivated vehicle', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    await vehicleService.update(fixture.admin, fixture.vehicleId, { isActive: false });

    const reloaded = await serviceService.getById(fixture.driver, service.id);

    // SRS 13.4: "shall not be silently removed from historical displays".
    expect(reloaded.vehicle.id).toBe(fixture.vehicleId);
    expect(reloaded.vehicle.isActive).toBe(false);
  });

  it('shows a driver only active vehicles, whatever they ask for', async () => {
    const listed = await vehicleService.list(fixture.driver, { isActive: false });

    expect(listed.every((vehicle) => vehicle.isActive)).toBe(true);
  });

  it('does not let a driver create one (SRS 20)', async () => {
    await expectAppError(
      vehicleService.create(fixture.driver, { registrationPlate: '0000 AAA', isActive: true }),
      'FORBIDDEN',
    );
  });

  it('rejects a duplicate registration plate', async () => {
    await expectAppError(
      vehicleService.create(fixture.admin, { registrationPlate: '1234 ABC', isActive: true }),
      'CONFLICT',
    );
  });
});

describe('routes (SRS 14, 26.5)', () => {
  it('lets an administrator create, edit origin/destination and deactivate', async () => {
    const created = await routeService.create(fixture.admin, {
      code: 'MAD-BIL-05',
      name: 'Madrid - Bilbao',
      origin: 'Madrid Sur',
      destination: 'Bilbao',
      isActive: true,
    });

    const moved = await routeService.update(fixture.admin, created.id, {
      origin: 'Getafe',
      destination: 'Barakaldo',
    });

    expect(moved.origin).toBe('Getafe');
    expect(moved.destination).toBe('Barakaldo');
  });

  it('affects future services but not existing ones (SRS 21.4, 26.5)', async () => {
    const before = await serviceService.create(fixture.driver, serviceBody(fixture));

    await routeService.update(fixture.admin, fixture.routeId, {
      origin: 'Getafe',
      destination: 'Toledo',
    });

    const after = await serviceService.create(fixture.driver, serviceBody(fixture));

    expect((await serviceService.getById(fixture.driver, before.id)).originSnapshot).toBe(
      'Madrid Sur',
    );
    expect(after.originSnapshot).toBe('Getafe');
  });

  it('does not let a driver list the route catalogue (SRS 14.3)', async () => {
    await expectAppError(routeService.list(fixture.driver), 'FORBIDDEN');
  });

  it('rejects a duplicate route code', async () => {
    await expectAppError(
      routeService.create(fixture.admin, {
        code: 'MAD-BCN-01',
        name: 'Duplicada',
        origin: 'A',
        destination: 'B',
        isActive: true,
      }),
      'CONFLICT',
    );
  });
});

describe('users and route assignments (SRS 12, 26.5)', () => {
  it('creates a fully configured driver in one step (SRS 12.2)', async () => {
    const created = await userService.create(fixture.admin, {
      name: 'Carlos Ruiz',
      loginIdentifier: 'conductor3',
      password: 'una-contrasena-larga-2026',
      role: 'DRIVER',
      isActive: true,
      defaultVehicleId: fixture.vehicleId,
      assignments: [
        { routeId: fixture.routeId, isDefault: true },
        { routeId: fixture.otherRouteId, isDefault: false },
      ],
    });

    expect(created.defaultVehicleId).toBe(fixture.vehicleId);
    expect(created.routeAssignments).toHaveLength(2);
  });

  it('never exposes the password hash (SRS 22.1)', async () => {
    const created = await userService.create(fixture.admin, {
      name: 'Carlos Ruiz',
      loginIdentifier: 'conductor3',
      password: 'una-contrasena-larga-2026',
      role: 'DRIVER',
      isActive: true,
      assignments: [],
    });

    expect(created).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(created)).not.toContain('argon2');
  });

  it('keeps the password out of the audit log (SRS 19.9, 22.7)', async () => {
    const created = await userService.create(fixture.admin, {
      name: 'Carlos Ruiz',
      loginIdentifier: 'conductor3',
      password: 'una-contrasena-larga-2026',
      role: 'DRIVER',
      isActive: true,
      assignments: [],
    });

    const entry = await prisma.auditLog.findFirstOrThrow({ where: { entityId: created.id } });

    expect(JSON.stringify(entry.afterData)).not.toContain('una-contrasena-larga-2026');
    expect(JSON.stringify(entry.afterData)).not.toContain('argon2');
  });

  it('allows only one default route per driver (SRS 12.6, 26.5)', async () => {
    await userService.replaceRouteAssignments(fixture.admin, fixture.driver.userId, {
      assignments: [
        { routeId: fixture.routeId, isDefault: false },
        { routeId: fixture.otherRouteId, isDefault: true },
      ],
    });

    const reloaded = await userService.getById(fixture.admin, fixture.driver.userId);
    const defaults = reloaded.routeAssignments.filter((assignment) => assignment.isDefault);

    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.routeId).toBe(fixture.otherRouteId);
  });

  it('moves the default without a transient double-default (SRS 12.6)', async () => {
    // The reason assignments are replaced rather than patched: the partial
    // unique index would reject an intermediate state with two defaults.
    for (const routeId of [fixture.otherRouteId, fixture.routeId, fixture.otherRouteId]) {
      await userService.replaceRouteAssignments(fixture.admin, fixture.driver.userId, {
        assignments: [
          { routeId: fixture.routeId, isDefault: routeId === fixture.routeId },
          { routeId: fixture.otherRouteId, isDefault: routeId === fixture.otherRouteId },
        ],
      });
    }

    const reloaded = await userService.getById(fixture.admin, fixture.driver.userId);
    expect(reloaded.routeAssignments.filter((a) => a.isDefault)).toHaveLength(1);
  });

  it('refuses to assign routes to an administrator (SRS 19.6)', async () => {
    await expectAppError(
      userService.replaceRouteAssignments(fixture.admin, fixture.admin.userId, {
        assignments: [{ routeId: fixture.routeId, isDefault: true }],
      }),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('refuses to assign a deactivated route', async () => {
    await expectAppError(
      userService.replaceRouteAssignments(fixture.admin, fixture.driver.userId, {
        assignments: [{ routeId: fixture.inactiveRouteId, isDefault: true }],
      }),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('deactivates a user while preserving their services (SRS 12.4, 21.5)', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    await userService.update(fixture.admin, fixture.driver.userId, { isActive: false });

    // The service survives, and an administrator can still read it.
    const reloaded = await serviceService.getById(fixture.admin, service.id);
    expect(reloaded.driverId).toBe(fixture.driver.userId);
  });

  it('records a password reset as a fact, never as a value (SRS 22.7)', async () => {
    await userService.update(fixture.admin, fixture.driver.userId, {
      password: 'otra-contrasena-larga-2026',
    });

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: fixture.driver.userId },
    });

    expect(entry.afterData).toMatchObject({ passwordReset: true });
    expect(JSON.stringify(entry.afterData)).not.toContain('otra-contrasena-larga-2026');
  });

  it('stops an administrator deactivating themselves', async () => {
    // Recoverable only by another administrator, and a two-person deployment
    // may not have one (SRS 3.3).
    await expectAppError(
      userService.update(fixture.admin, fixture.admin.userId, { isActive: false }),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('does not let a driver read the user list (SRS 20)', async () => {
    await expectAppError(userService.list(fixture.driver), 'FORBIDDEN');
  });

  it('does not let a driver create an account (SRS 26.8 - role escalation)', async () => {
    await expectAppError(
      userService.create(fixture.driver, {
        name: 'Escalada',
        loginIdentifier: 'escalada',
        password: 'una-contrasena-larga-2026',
        role: 'ADMIN',
        isActive: true,
        assignments: [],
      }),
      'FORBIDDEN',
    );
  });

  it('rejects a duplicate login identifier', async () => {
    await expectAppError(
      userService.create(fixture.admin, {
        name: 'Duplicado',
        loginIdentifier: 'conductor1',
        password: 'una-contrasena-larga-2026',
        role: 'DRIVER',
        isActive: true,
        assignments: [],
      }),
      'CONFLICT',
    );
  });
});

describe('clients (ERP roadmap Phase 1)', () => {
  it('lets an administrator create, edit and deactivate', async () => {
    const created = await clientService.create(fixture.admin, {
      name: 'Transportes Ejemplo SL',
      taxId: 'B12345678',
      isActive: true,
    });
    expect(created.name).toBe('Transportes Ejemplo SL');

    const renamed = await clientService.update(fixture.admin, created.id, {
      name: 'Transportes Ejemplo, S.L.',
    });
    expect(renamed.name).toBe('Transportes Ejemplo, S.L.');
    // Untouched fields survive a partial update.
    expect(renamed.taxId).toBe('B12345678');

    const deactivated = await clientService.update(fixture.admin, created.id, {
      isActive: false,
    });
    expect(deactivated.isActive).toBe(false);
  });

  it('allows a client with no tax id yet', async () => {
    const created = await clientService.create(fixture.admin, {
      name: 'Sin CIF todavía',
      isActive: true,
    });
    expect(created.taxId).toBeNull();
  });

  it('deletes a client nothing references (nothing does yet)', async () => {
    const created = await clientService.create(fixture.admin, {
      name: 'Para borrar',
      isActive: true,
    });

    await clientService.remove(fixture.admin, created.id);

    await expectAppError(clientService.getById(fixture.admin, created.id), 'NOT_FOUND');
  });

  it('does not let a driver create one (SRS 20 convention)', async () => {
    await expectAppError(
      clientService.create(fixture.driver, { name: 'Intento de conductor', isActive: true }),
      'FORBIDDEN',
    );
  });

  it('does not let a driver list clients', async () => {
    await expectAppError(clientService.list(fixture.driver), 'FORBIDDEN');
  });
});

describe('simple lookup lists (ERP roadmap Phase 1)', () => {
  it('lets an administrator create, edit and deactivate an item', async () => {
    const created = await lookupService.create(fixture.admin, 'FUEL_TYPE', {
      name: 'Diésel',
      isActive: true,
    });
    expect(created.name).toBe('Diésel');
    expect(created.kind).toBe('FUEL_TYPE');

    const renamed = await lookupService.update(fixture.admin, 'FUEL_TYPE', created.id, {
      name: 'Diésel B7',
    });
    expect(renamed.name).toBe('Diésel B7');

    const deactivated = await lookupService.update(fixture.admin, 'FUEL_TYPE', created.id, {
      isActive: false,
    });
    expect(deactivated.isActive).toBe(false);
  });

  it('scopes names per kind, not globally', async () => {
    // The same name in two different lists is not a collision.
    await lookupService.create(fixture.admin, 'FUEL_TYPE', { name: 'Efectivo', isActive: true });

    await expect(
      lookupService.create(fixture.admin, 'PAYMENT_METHOD', {
        name: 'Efectivo',
        isActive: true,
      }),
    ).resolves.toBeDefined();
  });

  it('rejects a duplicate name within the same kind', async () => {
    await lookupService.create(fixture.admin, 'PAYMENT_METHOD', {
      name: 'Transferencia',
      isActive: true,
    });

    await expectAppError(
      lookupService.create(fixture.admin, 'PAYMENT_METHOD', {
        name: 'Transferencia',
        isActive: true,
      }),
      'CONFLICT',
    );
  });

  it('404s on an id that belongs to a different kind', async () => {
    const created = await lookupService.create(fixture.admin, 'FUEL_TYPE', {
      name: 'Adblue',
      isActive: true,
    });

    await expectAppError(
      lookupService.getById(fixture.admin, 'PAYMENT_METHOD', created.id),
      'NOT_FOUND',
    );
  });

  it('does not let a driver create a list item', async () => {
    await expectAppError(
      lookupService.create(fixture.driver, 'SUPPLEMENT_TYPE', {
        name: 'Espera',
        isActive: true,
      }),
      'FORBIDDEN',
    );
  });
});

describe('operational defaults (ERP roadmap Phase 1, 99_Config)', () => {
  it('is seeded with the spreadsheet defaults', async () => {
    const config = await configService.get();

    expect(config.oilChangeIntervalKm).toBe(15_000);
    expect(config.defaultConsumptionMlPer100Km).toBe(11_000);
    expect(config.defaultFuelPriceCentsPerLiter).toBe(152);
  });

  it('lets an administrator change all three defaults together', async () => {
    const updated = await configService.update(fixture.admin, {
      oilChangeIntervalKm: 12_000,
      defaultConsumption: 10_500,
      defaultFuelPrice: 160,
    });

    expect(updated.oilChangeIntervalKm).toBe(12_000);
    expect(updated.defaultConsumptionMlPer100Km).toBe(10_500);
    expect(updated.defaultFuelPriceCentsPerLiter).toBe(160);
  });

  it('is readable by a driver, not admin-only', async () => {
    await expect(configService.get()).resolves.toBeDefined();
  });

  it('does not let a driver change it', async () => {
    await expectAppError(
      configService.update(fixture.driver, {
        oilChangeIntervalKm: 1,
        defaultConsumption: 1,
        defaultFuelPrice: 1,
      }),
      'FORBIDDEN',
    );
  });

  it('records a change in the audit log with before and after values', async () => {
    await configService.update(fixture.admin, {
      oilChangeIntervalKm: 12_000,
      defaultConsumption: 10_500,
      defaultFuelPrice: 160,
    });

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: 'APP_CONFIG' },
    });

    expect(entry.beforeData).toMatchObject({ oilChangeIntervalKm: 15_000 });
    expect(entry.afterData).toMatchObject({ oilChangeIntervalKm: 12_000 });
  });

  it('writes no audit row when nothing actually changes', async () => {
    const current = await configService.get();

    await configService.update(fixture.admin, {
      oilChangeIntervalKm: current.oilChangeIntervalKm,
      defaultConsumption: current.defaultConsumptionMlPer100Km,
      defaultFuelPrice: current.defaultFuelPriceCentsPerLiter,
    });

    const updates = await prisma.auditLog.count({ where: { entityType: 'APP_CONFIG' } });
    expect(updates).toBe(0);
  });
});

describe('suppliers (ERP roadmap Phase 3)', () => {
  it('lets an administrator create, edit and deactivate', async () => {
    const created = await supplierService.create(fixture.admin, {
      name: 'Taller Ejemplo SL',
      taxId: 'B87654321',
      isActive: true,
    });
    expect(created.name).toBe('Taller Ejemplo SL');

    const renamed = await supplierService.update(fixture.admin, created.id, {
      name: 'Taller Ejemplo, S.L.',
    });
    expect(renamed.name).toBe('Taller Ejemplo, S.L.');
    expect(renamed.taxId).toBe('B87654321');

    const deactivated = await supplierService.update(fixture.admin, created.id, {
      isActive: false,
    });
    expect(deactivated.isActive).toBe(false);
  });

  it('deletes a supplier nothing references', async () => {
    const created = await supplierService.create(fixture.admin, {
      name: 'Para borrar',
      isActive: true,
    });

    await supplierService.remove(fixture.admin, created.id);

    await expectAppError(supplierService.getById(fixture.admin, created.id), 'NOT_FOUND');
  });

  it('does not let a driver create one', async () => {
    await expectAppError(
      supplierService.create(fixture.driver, { name: 'Intento de conductor', isActive: true }),
      'FORBIDDEN',
    );
  });
});

describe('expense categories (ERP roadmap Phase 3)', () => {
  it('lets an administrator create, edit and deactivate', async () => {
    const created = await expenseCategoryService.create(fixture.admin, {
      name: 'Combustible',
      expenseType: 'OPERATION',
      defaultVatRate: 'REDUCED',
      isActive: true,
    });
    expect(created.expenseType).toBe('OPERATION');
    expect(created.defaultVatRate).toBe('REDUCED');

    const changed = await expenseCategoryService.update(fixture.admin, created.id, {
      expenseType: 'INVESTMENT',
    });
    expect(changed.expenseType).toBe('INVESTMENT');
    // Untouched fields survive a partial update.
    expect(changed.defaultVatRate).toBe('REDUCED');

    const deactivated = await expenseCategoryService.update(fixture.admin, created.id, {
      isActive: false,
    });
    expect(deactivated.isActive).toBe(false);
  });

  it('lists categories without requiring an actor (read-only, not admin-only)', async () => {
    await expenseCategoryService.create(fixture.admin, {
      name: 'Peajes',
      expenseType: 'OPERATION',
      defaultVatRate: 'STANDARD',
      isActive: true,
    });

    const listed = await expenseCategoryService.list({ isActive: true });
    expect(listed.some((category) => category.name === 'Peajes')).toBe(true);
  });

  it('does not let a driver create one', async () => {
    await expectAppError(
      expenseCategoryService.create(fixture.driver, {
        name: 'Intento de conductor',
        expenseType: 'OPERATION',
        defaultVatRate: 'STANDARD',
        isActive: true,
      }),
      'FORBIDDEN',
    );
  });
});
