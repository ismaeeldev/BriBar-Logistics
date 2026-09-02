/**
 * Deleting master data.
 *
 * The rule this file exists to hold in place: **a record any service points at
 * is never deleted.** SRS 21.5 makes deactivation the removal path and the
 * `onDelete: Restrict` foreign keys back it up, but the application now offers
 * a delete button, and a bug there would quietly destroy history that the whole
 * system exists to keep. So every case below is either "nothing referenced it,
 * so it went" or "something referenced it, so it stayed".
 *
 * The blocked cases assert the record is *still there* afterwards, not merely
 * that the call threw — a delete that throws after committing would pass the
 * weaker assertion.
 */
import { AuditAction, AuditEntityType, type Role } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Actor } from '@/lib/auth/session';
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

/**
 * A created account as the session would present it.
 *
 * `userService.create` returns the row; an `Actor` is what the session carries.
 * Passing the row directly typechecks under no rule and would silently give the
 * actor an `undefined` id, which is the one value that makes the "cannot delete
 * yourself" guard pass for the wrong reason.
 */
function asActor(user: { id: string; name: string; role: Role }): Actor {
  return { userId: user.id, name: user.name, role: user.role };
}

async function expectRejection(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    return error as AppError;
  }
  throw new Error('Expected the delete to be refused, but it succeeded.');
}

describe('deleting a vehicle', () => {
  it('removes one nothing references, and records who did it', async () => {
    const vehicle = await vehicleService.create(fixture.admin, {
      registrationPlate: '9999 ZZZ',
      isActive: true,
    });

    expect((await vehicleService.getDeletability(fixture.admin, vehicle.id)).canDelete).toBe(
      true,
    );

    await vehicleService.remove(fixture.admin, vehicle.id);

    expect(await prisma.vehicle.findUnique({ where: { id: vehicle.id } })).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: AuditEntityType.VEHICLE,
        entityId: vehicle.id,
        action: AuditAction.DELETE,
      },
    });
    expect(audit?.actorUserId).toBe(fixture.admin.userId);
  });

  it('refuses one a service used, and leaves it in place', async () => {
    await serviceService.create(fixture.driver, serviceBody(fixture));

    const deletability = await vehicleService.getDeletability(fixture.admin, fixture.vehicleId);
    expect(deletability.canDelete).toBe(false);
    expect(deletability.blockers).toContainEqual({ kind: 'services', count: 1 });

    await expectRejection(vehicleService.remove(fixture.admin, fixture.vehicleId));

    expect(
      await prisma.vehicle.findUnique({ where: { id: fixture.vehicleId } }),
    ).not.toBeNull();
  });

  it('refuses one a driver holds as their default', async () => {
    const deletability = await vehicleService.getDeletability(fixture.admin, fixture.vehicleId);
    expect(deletability.canDelete).toBe(false);
    expect(deletability.blockers.some((blocker) => blocker.kind === 'defaultForUsers')).toBe(
      true,
    );

    await expectRejection(vehicleService.remove(fixture.admin, fixture.vehicleId));
  });

  it('is refused for a driver', async () => {
    const vehicle = await vehicleService.create(fixture.admin, {
      registrationPlate: '8888 YYY',
      isActive: true,
    });

    await expectRejection(vehicleService.remove(fixture.driver, vehicle.id));
    expect(await prisma.vehicle.findUnique({ where: { id: vehicle.id } })).not.toBeNull();
  });
});

describe('deleting a route', () => {
  it('removes one nothing referenced', async () => {
    const route = await routeService.create(fixture.admin, {
      code: 'TMP-01',
      name: 'Temporary',
      origin: 'A',
      destination: 'B',
      isActive: true,
    });

    await routeService.remove(fixture.admin, route.id);
    expect(await prisma.route.findUnique({ where: { id: route.id } })).toBeNull();
  });

  it('refuses one a service used', async () => {
    await serviceService.create(fixture.driver, serviceBody(fixture));

    await expectRejection(routeService.remove(fixture.admin, fixture.routeId));
    expect(await prisma.route.findUnique({ where: { id: fixture.routeId } })).not.toBeNull();
  });

  it('takes its driver assignments with it, and says so beforehand', async () => {
    // `unassignedRouteId` is assigned to nobody; give it to a driver so the
    // cascade has something to carry.
    await prisma.driverRoute.create({
      data: { driverId: fixture.driver.userId, routeId: fixture.unassignedRouteId },
    });

    const deletability = await routeService.getDeletability(
      fixture.admin,
      fixture.unassignedRouteId,
    );
    expect(deletability.canDelete).toBe(true);
    expect(deletability.cascades).toContainEqual({ kind: 'routeAssignments', count: 1 });

    await routeService.remove(fixture.admin, fixture.unassignedRouteId);

    expect(
      await prisma.driverRoute.count({ where: { routeId: fixture.unassignedRouteId } }),
    ).toBe(0);
  });
});

describe('deleting an account', () => {
  it('removes one that never filed a service', async () => {
    const user = await userService.create(fixture.admin, {
      name: 'Never Started',
      loginIdentifier: 'never1',
      password: 'Str0ng-Passw0rd!',
      role: 'DRIVER',
      isActive: true,
      assignments: [],
    });

    await userService.remove(fixture.admin, user.id);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  });

  it('refuses a driver with services', async () => {
    await serviceService.create(fixture.driver, serviceBody(fixture));

    const deletability = await userService.getDeletability(
      fixture.admin,
      fixture.driver.userId,
    );
    expect(deletability.canDelete).toBe(false);

    await expectRejection(userService.remove(fixture.admin, fixture.driver.userId));
    expect(
      await prisma.user.findUnique({ where: { id: fixture.driver.userId } }),
    ).not.toBeNull();
  });

  it('refuses an administrator who has approved something', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));
    await serviceService.approve(fixture.admin, service.id);

    // A second administrator, so the refusal is about the approval rather than
    // about the actor deleting themselves.
    const created = await userService.create(fixture.admin, {
      name: 'Other Admin',
      loginIdentifier: 'admin2',
      password: 'Str0ng-Passw0rd!',
      role: 'ADMIN',
      isActive: true,
      assignments: [],
    });
    const other = asActor(created);

    const deletability = await userService.getDeletability(other, fixture.admin.userId);
    expect(deletability.canDelete).toBe(false);
    expect(deletability.blockers.some((blocker) => blocker.kind === 'approvals')).toBe(true);

    await expectRejection(userService.remove(other, fixture.admin.userId));
  });

  it('never lets an administrator delete their own account', async () => {
    const fresh = await userService.create(fixture.admin, {
      name: 'Fresh Admin',
      loginIdentifier: 'admin3',
      password: 'Str0ng-Passw0rd!',
      role: 'ADMIN',
      isActive: true,
      assignments: [],
    });

    const self = asActor(fresh);

    // Nothing references this account, so only the self-check can refuse it.
    expect((await userService.getDeletability(self, fresh.id)).canDelete).toBe(false);
    await expectRejection(userService.remove(self, fresh.id));

    expect(await prisma.user.findUnique({ where: { id: fresh.id } })).not.toBeNull();
  });
});
