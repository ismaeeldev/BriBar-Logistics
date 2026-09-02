/**
 * The service workflow, end to end (SRS 26.2, 26.4, 26.6, 26.8).
 *
 * Runs the real service layer against the real database. Authentication is the
 * only thing stubbed — an `Actor` is built directly rather than read from a
 * session — so ownership scoping, status gates, transactions, audit writes and
 * database constraints are all live.
 *
 * The security cases are the point. SRS 26.8 asks for tests proving that role
 * escalation and driver-ID substitution fail; those are assertions about
 * rejection, and the only way to make them meaningful is to attempt the attack
 * against the same code path a real request would take.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { asTimeOfDay } from '@/lib/time/time-of-day';
import { serviceService } from '@/modules/services/service/service.service';

import { prisma, seedFixture, serviceBody, ServiceStatus, type Fixture } from './helpers';

let fixture: Fixture;

beforeEach(async () => {
  fixture = await seedFixture();
});

/** Asserts that a call fails with a specific `AppError` code. */
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

describe('creating a service (SRS 9, 26.2)', () => {
  it('stores it as Pending Approval, owned by the driver', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    expect(service.status).toBe(ServiceStatus.PENDING_APPROVAL);
    expect(service.driverId).toBe(fixture.driver.userId);
  });

  it('calculates both mileage values server-side (SRS 10.1)', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    expect(service.actualKm).toBe(100);
    expect(service.serviceKm).toBe(60);
  });

  it('snapshots the route origin and destination (SRS 14.5)', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    expect(service.originSnapshot).toBe('Madrid Sur');
    expect(service.destinationSnapshot).toBe('Barcelona Zona Franca');
  });

  it('does not rewrite that snapshot when the route master changes (SRS 21.4)', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    await prisma.route.update({
      where: { id: fixture.routeId },
      data: { origin: 'Getafe', destination: 'Toledo' },
    });

    const reloaded = await serviceService.getById(fixture.driver, service.id);

    expect(reloaded.originSnapshot).toBe('Madrid Sur');
    expect(reloaded.route.code).toBe('MAD-BCN-01');
  });

  it('issues sequential Service IDs continuing the client numbering (SRS 19.1)', async () => {
    const first = await serviceService.create(fixture.driver, serviceBody(fixture));
    const second = await serviceService.create(fixture.driver, serviceBody(fixture));

    expect(first.serviceCode).toBe('1');
    expect(second.serviceCode).toBe('2');
  });

  it('never issues the same Service ID to concurrent submissions (SRS 23.4, 26.6)', async () => {
    // SRS 26.6: "Two Drivers/users can submit at approximately the same time.
    // Each receives a unique service record/Service ID."
    const created = await Promise.all([
      serviceService.create(fixture.driver, serviceBody(fixture)),
      serviceService.create(fixture.otherDriver, serviceBody(fixture)),
      serviceService.create(fixture.driver, serviceBody(fixture)),
      serviceService.create(fixture.otherDriver, serviceBody(fixture)),
    ]);

    const codes = created.map((service) => service.serviceCode);

    expect(new Set(codes).size).toBe(4);
    // And neither driver's data landed on the other's record.
    expect(created[0]?.driverId).toBe(fixture.driver.userId);
    expect(created[1]?.driverId).toBe(fixture.otherDriver.userId);
  });

  it('records the creation in the audit log (SRS 21.1)', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    const entries = await prisma.auditLog.findMany({ where: { entityId: service.id } });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.action).toBe('CREATE');
    expect(entries[0]?.actorUserId).toBe(fixture.driver.userId);
  });

  it('records the initial status transition (SRS 21.2)', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    const history = await serviceService.getStatusHistory(fixture.driver, service.id);

    expect(history).toHaveLength(1);
    expect(history[0]?.fromStatus).toBeNull();
    expect(history[0]?.toStatus).toBe(ServiceStatus.PENDING_APPROVAL);
  });

  it('rejects a route the driver is not assigned (SRS 14.3, 26.2)', async () => {
    // "Unassigned routes do not appear and are rejected server-side if
    // manually submitted."
    await expectAppError(
      serviceService.create(
        fixture.driver,
        serviceBody(fixture, { routeId: fixture.unassignedRouteId }),
      ),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('rejects an assigned route that has been deactivated (SRS 14.3)', async () => {
    await expectAppError(
      serviceService.create(
        fixture.driver,
        serviceBody(fixture, { routeId: fixture.inactiveRouteId }),
      ),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('rejects a deactivated vehicle (SRS 13.4)', async () => {
    await expectAppError(
      serviceService.create(
        fixture.driver,
        serviceBody(fixture, { vehicleId: fixture.inactiveVehicleId }),
      ),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('rejects invalid mileage even when the schema is bypassed (SRS 10.2)', async () => {
    // Calls the service directly with readings no Zod schema would pass, which
    // is what a future internal caller might do.
    await expectAppError(
      serviceService.create(fixture.driver, serviceBody(fixture, { endBaseKm: 9_000 })),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('rejects a same-day service arriving before it departed (decision #3)', async () => {
    await expectAppError(
      serviceService.create(
        fixture.driver,
        serviceBody(fixture, {
          departureTime: asTimeOfDay('15:30'),
          arrivalTime: asTimeOfDay('07:45'),
        }),
      ),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('accepts an overnight service when flagged (SRS 31.3)', async () => {
    const service = await serviceService.create(
      fixture.driver,
      serviceBody(fixture, {
        departureTime: asTimeOfDay('22:00'),
        arrivalTime: asTimeOfDay('02:00'),
        endsNextDay: true,
      }),
    );

    expect(service.endsNextDay).toBe(true);
  });
});

describe('administrators filing on a driver behalf (client decision #7)', () => {
  it('records the service against the named driver, not the administrator', async () => {
    const service = await serviceService.create(fixture.admin, {
      ...serviceBody(fixture),
      driverId: fixture.driver.userId,
    });

    expect(service.driverId).toBe(fixture.driver.userId);
  });

  it('keeps authorship answerable in the audit log (SRS 21.1)', async () => {
    const service = await serviceService.create(fixture.admin, {
      ...serviceBody(fixture),
      driverId: fixture.driver.userId,
    });

    const entry = await prisma.auditLog.findFirstOrThrow({ where: { entityId: service.id } });

    // Ownership and authorship differ, and both are recorded.
    expect(entry.actorUserId).toBe(fixture.admin.userId);
    expect(entry.afterData).toMatchObject({ filedByAdministrator: true });
  });

  it('still enforces the driver route assignment (SRS 14.3)', async () => {
    // An administrator can file on someone's behalf, but not into a
    // configuration the driver could not have used themselves.
    await expectAppError(
      serviceService.create(fixture.admin, {
        ...serviceBody(fixture, { routeId: fixture.otherRouteId }),
        driverId: fixture.otherDriver.userId,
      }),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('refuses to file a service against another administrator', async () => {
    await expectAppError(
      serviceService.create(fixture.admin, {
        ...serviceBody(fixture),
        driverId: fixture.admin.userId,
      }),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('refuses to file against a deactivated driver (SRS 12.4)', async () => {
    await prisma.user.update({
      where: { id: fixture.driver.userId },
      data: { isActive: false },
    });

    await expectAppError(
      serviceService.create(fixture.admin, {
        ...serviceBody(fixture),
        driverId: fixture.driver.userId,
      }),
      'BUSINESS_RULE_VIOLATION',
    );
  });
});

describe('visibility (SRS 9.7, 26.8)', () => {
  it('lets a driver read their own service', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    await expect(serviceService.getById(fixture.driver, service.id)).resolves.toBeDefined();
  });

  it('hides another driver service behind a 404, not a 403 (SRS 18.7, 24.3)', async () => {
    // "Driver ID substitution fails" (SRS 26.8). 404 rather than 403 because
    // 403 would confirm the record exists.
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    await expectAppError(serviceService.getById(fixture.otherDriver, service.id), 'NOT_FOUND');
  });

  it('lets an administrator read every service', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    await expect(serviceService.getById(fixture.admin, service.id)).resolves.toBeDefined();
  });

  it('scopes a driver list to their own services regardless of the filter', async () => {
    await serviceService.create(fixture.driver, serviceBody(fixture));
    await serviceService.create(fixture.otherDriver, serviceBody(fixture));

    // Asking for the other driver's services explicitly.
    const listed = await serviceService.list(fixture.driver, {
      page: 1,
      pageSize: 25,
      driverId: fixture.otherDriver.userId,
    });

    expect(listed.total).toBe(1);
    expect(listed.items[0]?.driverId).toBe(fixture.driver.userId);
  });

  it('honours the driver filter for an administrator (SRS 16.3)', async () => {
    await serviceService.create(fixture.driver, serviceBody(fixture));
    await serviceService.create(fixture.otherDriver, serviceBody(fixture));

    const listed = await serviceService.list(fixture.admin, {
      page: 1,
      pageSize: 25,
      driverId: fixture.otherDriver.userId,
    });

    expect(listed.total).toBe(1);
    expect(listed.items[0]?.driverId).toBe(fixture.otherDriver.userId);
  });
});

describe('editing (SRS 11.2, 11.4, 26.4)', () => {
  it('lets a driver edit their own pending service and recalculates (SRS 10.4)', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    const updated = await serviceService.update(
      fixture.driver,
      service.id,
      serviceBody(fixture, { endDashboardKm: 10_200 }),
    );

    expect(updated.actualKm).toBe(200);
  });

  it('does not let a driver edit another driver service', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    await expectAppError(
      serviceService.update(fixture.otherDriver, service.id, serviceBody(fixture)),
      'NOT_FOUND',
    );
  });

  it('lets an administrator edit a pending service', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    await expect(
      serviceService.update(
        fixture.admin,
        service.id,
        serviceBody(fixture, { observations: 'Corregido por administración' }),
      ),
    ).resolves.toBeDefined();
  });

  it('audits an edit with only the fields that changed (SRS 21.3)', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    await serviceService.update(
      fixture.driver,
      service.id,
      serviceBody(fixture, { endDashboardKm: 10_200 }),
    );

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: service.id, action: 'UPDATE' },
    });

    expect(entry.beforeData).toMatchObject({ endDashboardKm: 10_100, actualKm: 100 });
    expect(entry.afterData).toMatchObject({ endDashboardKm: 10_200, actualKm: 200 });
    // Untouched fields stay out of the diff, so a reviewer sees the change
    // rather than the whole row.
    expect(entry.beforeData).not.toHaveProperty('startBaseKm');
  });

  it('writes no audit row for a no-op edit', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    await serviceService.update(fixture.driver, service.id, serviceBody(fixture));

    const updates = await prisma.auditLog.count({
      where: { entityId: service.id, action: 'UPDATE' },
    });

    expect(updates).toBe(0);
  });
});

describe('approval (SRS 11.3, 26.4)', () => {
  it('lets an administrator approve and records who and when', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    const approved = await serviceService.approve(fixture.admin, service.id);

    expect(approved.status).toBe(ServiceStatus.APPROVED);
    expect(approved.approvedByUserId).toBe(fixture.admin.userId);
    expect(approved.approvedAt).toBeInstanceOf(Date);
  });

  it('does not let a driver approve their own service (SRS 20)', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    await expectAppError(serviceService.approve(fixture.driver, service.id), 'FORBIDDEN');
  });

  it('records the transition in the status history (SRS 21.2)', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));
    await serviceService.approve(fixture.admin, service.id);

    const history = await serviceService.getStatusHistory(fixture.admin, service.id);

    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({
      fromStatus: ServiceStatus.PENDING_APPROVAL,
      toStatus: ServiceStatus.APPROVED,
      changedByUserId: fixture.admin.userId,
    });
  });

  it('rejects a second approval (SRS 34.1)', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));
    await serviceService.approve(fixture.admin, service.id);

    await expectAppError(serviceService.approve(fixture.admin, service.id), 'CONFLICT');
  });

  it('lets only one of two simultaneous approvals succeed', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    const results = await Promise.allSettled([
      serviceService.approve(fixture.admin, service.id),
      serviceService.approve(fixture.admin, service.id),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);

    // And exactly one transition was recorded, not two.
    const history = await serviceService.getStatusHistory(fixture.admin, service.id);
    expect(history.filter((entry) => entry.toStatus === ServiceStatus.APPROVED)).toHaveLength(
      1,
    );
  });
});

describe('the approved lock (SRS 11.4, 11.5, 34.3)', () => {
  it('stops a driver editing an approved service', async () => {
    // SRS 34.3: "Approval changes authorization, not merely appearance. A
    // Driver update request against an Approved service must fail even if it
    // is sent manually without using the UI." This calls the service layer
    // directly - there is no UI in the path at all.
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));
    await serviceService.approve(fixture.admin, service.id);

    await expectAppError(
      serviceService.update(
        fixture.driver,
        service.id,
        serviceBody(fixture, { endDashboardKm: 99_999 }),
      ),
      'CONFLICT',
    );
  });

  it('still lets the driver read it (SRS 11.4)', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));
    await serviceService.approve(fixture.admin, service.id);

    await expect(serviceService.getById(fixture.driver, service.id)).resolves.toBeDefined();
  });

  it('lets an administrator edit it (SRS 11.4, 21.3)', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));
    await serviceService.approve(fixture.admin, service.id);

    const updated = await serviceService.update(
      fixture.admin,
      service.id,
      serviceBody(fixture, { endDashboardKm: 10_150 }),
    );

    expect(updated.actualKm).toBe(150);
    // The status is unchanged by an edit.
    expect(updated.status).toBe(ServiceStatus.APPROVED);
  });

  it('does not restore the driver edit permission after an admin edit', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));
    await serviceService.approve(fixture.admin, service.id);
    await serviceService.update(fixture.admin, service.id, serviceBody(fixture));

    await expectAppError(
      serviceService.update(fixture.driver, service.id, serviceBody(fixture)),
      'CONFLICT',
    );
  });

  it('flags an administrator edit after approval in the audit log (SRS 21.3)', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));
    await serviceService.approve(fixture.admin, service.id);
    await serviceService.update(
      fixture.admin,
      service.id,
      serviceBody(fixture, { endDashboardKm: 10_150 }),
    );

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: service.id, action: 'UPDATE' },
    });

    expect(entry.afterData).toMatchObject({ editedAfterApproval: true });
  });

  it('fails a driver edit that races an approval (SRS 24.4)', async () => {
    // The scenario SRS 24.4 describes: the driver opened a pending service, an
    // administrator approved it, and the driver saves. The status is folded
    // into the UPDATE's WHERE clause, so there is no window between the check
    // and the write.
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));

    const [, driverEdit] = await Promise.allSettled([
      serviceService.approve(fixture.admin, service.id),
      serviceService.update(
        fixture.driver,
        service.id,
        serviceBody(fixture, { endDashboardKm: 10_500 }),
      ),
    ]);

    const reloaded = await serviceService.getById(fixture.admin, service.id);

    if (driverEdit.status === 'rejected') {
      // The approval won: the driver's edit was refused and did not land.
      expect(reloaded.status).toBe(ServiceStatus.APPROVED);
      expect(reloaded.endDashboardKm).toBe(10_100);
    } else {
      // The edit won: it was applied while the service was still pending, and
      // the approval then succeeded on the updated row. Either ordering is
      // correct; what must never happen is both, or a silent overwrite.
      expect(reloaded.endDashboardKm).toBe(10_500);
    }
  });
});

describe('the Add Service context (SRS 9.2, 18.3, 24.2)', () => {
  it('supplies the default vehicle, assigned routes and default route', async () => {
    const context = await serviceService.getContext(fixture.driver);

    expect(context.driver.id).toBe(fixture.driver.userId);
    expect(context.defaultVehicleId).toBe(fixture.vehicleId);
    expect(context.defaultRouteId).toBe(fixture.routeId);
  });

  it('offers only active assigned routes (SRS 14.3)', async () => {
    const context = await serviceService.getContext(fixture.driver);
    const offered = context.routes.map((route) => route.id);

    expect(offered).toContain(fixture.routeId);
    expect(offered).toContain(fixture.otherRouteId);
    // Assigned, but deactivated.
    expect(offered).not.toContain(fixture.inactiveRouteId);
    // Active, but not assigned to this driver.
    expect(offered).not.toContain(fixture.unassignedRouteId);
  });

  it('offers only active vehicles (SRS 13.4)', async () => {
    const context = await serviceService.getContext(fixture.driver);
    const offered = context.vehicles.map((vehicle) => vehicle.id);

    expect(offered).toContain(fixture.vehicleId);
    expect(offered).not.toContain(fixture.inactiveVehicleId);
  });

  it('asks for configuration when the driver has no routes (SRS 24.2)', async () => {
    await prisma.driverRoute.deleteMany({ where: { driverId: fixture.driver.userId } });

    const error = await expectAppError(
      serviceService.getContext(fixture.driver),
      'CONFIGURATION_REQUIRED',
    );

    // SRS 24.2 requires the message to say what an administrator must do, not
    // merely that something is missing.
    expect(error.message).toMatch(/administrador/i);
  });

  it('does not preselect a default vehicle that has been deactivated', async () => {
    await prisma.vehicle.update({
      where: { id: fixture.vehicleId },
      data: { isActive: false },
    });

    const context = await serviceService.getContext(fixture.driver);

    // Not a blocker - SRS 12.5 lets the driver pick another active vehicle -
    // but it must not be preselected.
    expect(context.defaultVehicleId).toBeNull();
  });

  it('does not let a driver request another driver context', async () => {
    const context = await serviceService.getContext(fixture.driver, fixture.otherDriver.userId);

    // The parameter is ignored for a driver rather than honoured or rejected,
    // so a driver appending it to the URL simply gets their own.
    expect(context.driver.id).toBe(fixture.driver.userId);
  });

  it('lets an administrator request a driver context (client decision #7)', async () => {
    const context = await serviceService.getContext(fixture.admin, fixture.driver.userId);

    expect(context.driver.id).toBe(fixture.driver.userId);
    expect(context.defaultRouteId).toBe(fixture.routeId);
  });
});
