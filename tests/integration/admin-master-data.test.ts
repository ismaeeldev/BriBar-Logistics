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
import { routeService } from '@/modules/routes/service/route.service';
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
