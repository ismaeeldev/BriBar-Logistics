/**
 * The database's own guarantees.
 *
 * The unit suite proves the domain rules are correct. This suite proves they
 * are also *unbypassable* - that a write reaching PostgreSQL without going
 * through the service layer still cannot produce a record the SRS forbids.
 *
 * Every test here writes through Prisma directly, deliberately skipping the
 * validation the application would normally apply, and asserts that the
 * database rejects it anyway.
 */
import { Role, ServiceStatus } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';

import { asTimeOfDay, dateToTimeOfDay, timeOfDayToDate } from '@/lib/time/time-of-day';
import {
  SERVICE_CODE_SEQUENCE,
  formatServiceCode,
} from '@/modules/services/domain/service-code';

import { testPrisma as prisma } from './setup';

// A password hash shape, not a real credential - nothing here ever verifies it.
const HASH = '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNoaGFzaA';

interface Fixture {
  driverId: string;
  adminId: string;
  vehicleId: string;
  routeId: string;
}

async function createFixture(): Promise<Fixture> {
  const vehicle = await prisma.vehicle.create({
    data: { registrationPlate: 'AA-01-BB', referenceName: 'Unit 1' },
  });
  const route = await prisma.route.create({
    data: {
      code: 'LIS-PRT-01',
      name: 'Lisboa - Porto',
      origin: 'Lisboa DC',
      destination: 'Porto Terminal',
    },
  });
  const driver = await prisma.user.create({
    data: {
      name: 'Ana Ferreira',
      loginIdentifier: 'driver1',
      passwordHash: HASH,
      role: Role.DRIVER,
      defaultVehicleId: vehicle.id,
    },
  });
  const admin = await prisma.user.create({
    data: {
      name: 'Administrator',
      loginIdentifier: 'admin',
      passwordHash: HASH,
      role: Role.ADMIN,
    },
  });

  return { driverId: driver.id, adminId: admin.id, vehicleId: vehicle.id, routeId: route.id };
}

/** A valid service payload; individual tests override the field under test. */
function serviceData(fixture: Fixture, overrides: Record<string, unknown> = {}) {
  return {
    serviceCode: String(Math.floor(Math.random() * 1e9)),
    serviceDate: new Date('2026-09-02T00:00:00.000Z'),
    driverId: fixture.driverId,
    vehicleId: fixture.vehicleId,
    routeId: fixture.routeId,
    originSnapshot: 'Lisboa DC',
    destinationSnapshot: 'Porto Terminal',
    startDashboardKm: 10_000,
    startBaseKm: 10_020,
    endBaseKm: 10_080,
    endDashboardKm: 10_100,
    actualKm: 100,
    serviceKm: 60,
    departureTime: timeOfDayToDate(asTimeOfDay('07:45')),
    arrivalTime: timeOfDayToDate(asTimeOfDay('15:30')),
    ...overrides,
  };
}

let fixture: Fixture;

beforeEach(async () => {
  fixture = await createFixture();
});

describe('mileage constraints (SRS 10.3)', () => {
  it('accepts a correctly ordered service', async () => {
    const service = await prisma.service.create({ data: serviceData(fixture) });

    expect(service.actualKm).toBe(100);
    expect(service.serviceKm).toBe(60);
    expect(service.status).toBe(ServiceStatus.PENDING_APPROVAL);
  });

  it('rejects a zero-distance service (client decision #4)', async () => {
    // SRS 26.3 left this to "operational acceptability" and the client ruled
    // it out, so the middle link of the chain is now strict.
    await expect(
      prisma.service.create({
        data: serviceData(fixture, {
          startDashboardKm: 500,
          startBaseKm: 500,
          endBaseKm: 500,
          endDashboardKm: 500,
          actualKm: 0,
          serviceKm: 0,
        }),
      }),
    ).rejects.toThrow(/services_mileage_sequence/);
  });

  it('accepts a truck that starts and ends parked at the base', async () => {
    // Only the middle link is strict. Start Dashboard may equal Start Base,
    // and End Base may equal End Dashboard - both routine when the vehicle is
    // already at the depot.
    await expect(
      prisma.service.create({
        data: serviceData(fixture, {
          startDashboardKm: 10_000,
          startBaseKm: 10_000,
          endBaseKm: 10_060,
          endDashboardKm: 10_060,
          actualKm: 60,
          serviceKm: 60,
        }),
      }),
    ).resolves.toBeDefined();
  });

  it('rejects Start Base below Start Dashboard', async () => {
    await expect(
      prisma.service.create({
        data: serviceData(fixture, { startBaseKm: 9_990, serviceKm: 90 }),
      }),
    ).rejects.toThrow(/services_mileage_sequence/);
  });

  it('rejects End Base at or below Start Base', async () => {
    await expect(
      prisma.service.create({
        data: serviceData(fixture, { endBaseKm: 10_010, serviceKm: -10 }),
      }),
    ).rejects.toThrow(/services_mileage_sequence|services_service_km/);

    await expect(
      prisma.service.create({
        data: serviceData(fixture, { endBaseKm: 10_020, serviceKm: 0 }),
      }),
    ).rejects.toThrow(/services_mileage_sequence/);
  });

  it('rejects End Dashboard below End Base', async () => {
    await expect(
      prisma.service.create({
        data: serviceData(fixture, { endDashboardKm: 10_050, actualKm: 50 }),
      }),
    ).rejects.toThrow(/services_mileage_sequence/);
  });

  it('rejects negative readings', async () => {
    await expect(
      prisma.service.create({
        data: serviceData(fixture, {
          startDashboardKm: -1,
          startBaseKm: -1,
          endBaseKm: -1,
          endDashboardKm: -1,
          actualKm: 0,
          serviceKm: 0,
        }),
      }),
    ).rejects.toThrow(/services_mileage_non_negative/);
  });
});

describe('calculated-column constraints (SRS 10.1, 22.4)', () => {
  it('rejects an Actual Km that does not match the formula', async () => {
    // The scenario from SRS 26.3: "Browser-manipulated calculated values
    // ignored in favor of server calculation." Even if a code path forgot to
    // recalculate and passed a client-supplied total straight through, the
    // database refuses it.
    await expect(
      prisma.service.create({ data: serviceData(fixture, { actualKm: 999 }) }),
    ).rejects.toThrow(/services_actual_km_formula/);
  });

  it('rejects a Service Km that does not match the formula', async () => {
    await expect(
      prisma.service.create({ data: serviceData(fixture, { serviceKm: 5 }) }),
    ).rejects.toThrow(/services_service_km_formula/);
  });

  it('recalculates correctly on edit (SRS 10.4)', async () => {
    const service = await prisma.service.create({ data: serviceData(fixture) });

    const updated = await prisma.service.update({
      where: { id: service.id },
      data: { endDashboardKm: 10_200, actualKm: 200 },
    });

    expect(updated.actualKm).toBe(200);
  });

  it('rejects an edit that updates a reading without its calculated value', async () => {
    const service = await prisma.service.create({ data: serviceData(fixture) });

    await expect(
      prisma.service.update({
        where: { id: service.id },
        data: { endDashboardKm: 10_200 }, // actualKm left at 100
      }),
    ).rejects.toThrow(/services_actual_km_formula/);
  });
});

describe('approval metadata (SRS 11.3, 21.1)', () => {
  it('rejects an approved service with no approver', async () => {
    await expect(
      prisma.service.create({
        data: serviceData(fixture, {
          status: ServiceStatus.APPROVED,
          approvedAt: new Date(),
        }),
      }),
    ).rejects.toThrow(/services_approval_metadata_consistent/);
  });

  it('rejects a pending service that carries approval metadata', async () => {
    await expect(
      prisma.service.create({
        data: serviceData(fixture, {
          status: ServiceStatus.PENDING_APPROVAL,
          approvedAt: new Date(),
          approvedByUserId: fixture.adminId,
        }),
      }),
    ).rejects.toThrow(/services_approval_metadata_consistent/);
  });

  it('accepts an approval that sets status, timestamp and approver together', async () => {
    const service = await prisma.service.create({ data: serviceData(fixture) });

    const approved = await prisma.service.update({
      where: { id: service.id },
      data: {
        status: ServiceStatus.APPROVED,
        approvedAt: new Date(),
        approvedByUserId: fixture.adminId,
      },
    });

    expect(approved.status).toBe(ServiceStatus.APPROVED);
    expect(approved.approvedByUserId).toBe(fixture.adminId);
  });
});

describe('route assignments (SRS 12.6, 19.6)', () => {
  it('allows many assigned routes with one default', async () => {
    const second = await prisma.route.create({
      data: {
        code: 'LIS-FAR-02',
        name: 'Lisboa - Faro',
        origin: 'Lisboa',
        destination: 'Faro',
      },
    });

    await prisma.driverRoute.createMany({
      data: [
        { driverId: fixture.driverId, routeId: fixture.routeId, isDefault: true },
        { driverId: fixture.driverId, routeId: second.id, isDefault: false },
      ],
    });

    expect(await prisma.driverRoute.count({ where: { driverId: fixture.driverId } })).toBe(2);
  });

  it('rejects a second default route for the same driver', async () => {
    const second = await prisma.route.create({
      data: {
        code: 'LIS-FAR-02',
        name: 'Lisboa - Faro',
        origin: 'Lisboa',
        destination: 'Faro',
      },
    });

    await prisma.driverRoute.create({
      data: { driverId: fixture.driverId, routeId: fixture.routeId, isDefault: true },
    });

    await expect(
      prisma.driverRoute.create({
        data: { driverId: fixture.driverId, routeId: second.id, isDefault: true },
      }),
    ).rejects.toThrow(/driver_routes_one_default_per_driver/);
  });

  it('allows each driver their own default', async () => {
    const otherDriver = await prisma.user.create({
      data: {
        name: 'Bruno Costa',
        loginIdentifier: 'driver2',
        passwordHash: HASH,
        role: Role.DRIVER,
      },
    });

    await prisma.driverRoute.create({
      data: { driverId: fixture.driverId, routeId: fixture.routeId, isDefault: true },
    });

    await expect(
      prisma.driverRoute.create({
        data: { driverId: otherDriver.id, routeId: fixture.routeId, isDefault: true },
      }),
    ).resolves.toBeDefined();
  });

  it('rejects assigning the same route to a driver twice', async () => {
    await prisma.driverRoute.create({
      data: { driverId: fixture.driverId, routeId: fixture.routeId },
    });

    await expect(
      prisma.driverRoute.create({
        data: { driverId: fixture.driverId, routeId: fixture.routeId },
      }),
    ).rejects.toThrow(/driver_routes_driver_id_route_id_key/);
  });
});

describe('historical integrity (SRS 14.5, 21.4, 21.5)', () => {
  it('keeps a service’s origin and destination when the route master changes', async () => {
    const service = await prisma.service.create({ data: serviceData(fixture) });

    await prisma.route.update({
      where: { id: fixture.routeId },
      data: { origin: 'Setubal Yard', destination: 'Evora Warehouse' },
    });

    const reloaded = await prisma.service.findUniqueOrThrow({ where: { id: service.id } });

    expect(reloaded.originSnapshot).toBe('Lisboa DC');
    expect(reloaded.destinationSnapshot).toBe('Porto Terminal');
  });

  it('refuses to delete a vehicle referenced by a service', async () => {
    await prisma.service.create({ data: serviceData(fixture) });

    await expect(prisma.vehicle.delete({ where: { id: fixture.vehicleId } })).rejects.toThrow();
  });

  it('refuses to delete a driver who has services', async () => {
    await prisma.service.create({ data: serviceData(fixture) });

    await expect(prisma.user.delete({ where: { id: fixture.driverId } })).rejects.toThrow();
  });

  it('keeps a deactivated vehicle attached to its historical services (SRS 13.4)', async () => {
    const service = await prisma.service.create({ data: serviceData(fixture) });

    await prisma.vehicle.update({
      where: { id: fixture.vehicleId },
      data: { isActive: false },
    });

    const reloaded = await prisma.service.findUniqueOrThrow({
      where: { id: service.id },
      include: { vehicle: true },
    });

    expect(reloaded.vehicle.isActive).toBe(false);
    expect(reloaded.vehicle.registrationPlate).toBe('AA-01-BB');
  });
});

describe('time-of-day round trip (SRS 31.3)', () => {
  it('stores and returns the exact clock time the driver entered', async () => {
    // The assertion this file exists for. Prisma maps a `time` column to a
    // JS Date, and if the mapper used local accessors instead of UTC ones,
    // this would come back shifted by the server's offset.
    const service = await prisma.service.create({
      data: serviceData(fixture, {
        departureTime: timeOfDayToDate(asTimeOfDay('07:45')),
        arrivalTime: timeOfDayToDate(asTimeOfDay('23:59')),
      }),
    });

    const reloaded = await prisma.service.findUniqueOrThrow({ where: { id: service.id } });

    expect(dateToTimeOfDay(reloaded.departureTime)).toBe('07:45');
    expect(dateToTimeOfDay(reloaded.arrivalTime)).toBe('23:59');
  });

  it('handles midnight without wrapping to the previous day', async () => {
    const service = await prisma.service.create({
      data: serviceData(fixture, {
        departureTime: timeOfDayToDate(asTimeOfDay('00:00')),
        arrivalTime: timeOfDayToDate(asTimeOfDay('00:01')),
      }),
    });

    const reloaded = await prisma.service.findUniqueOrThrow({ where: { id: service.id } });

    expect(dateToTimeOfDay(reloaded.departureTime)).toBe('00:00');
    expect(dateToTimeOfDay(reloaded.arrivalTime)).toBe('00:01');
  });

  it('stores the business date without shifting it', async () => {
    const service = await prisma.service.create({
      data: serviceData(fixture, { serviceDate: new Date('2026-09-02T00:00:00.000Z') }),
    });

    const reloaded = await prisma.service.findUniqueOrThrow({ where: { id: service.id } });

    expect(reloaded.serviceDate.toISOString()).toBe('2026-09-02T00:00:00.000Z');
  });
});

describe('service code sequence (SRS 19.1, 23.4)', () => {
  async function nextSequenceValue(): Promise<bigint> {
    const rows = await prisma.$queryRawUnsafe<{ nextval: bigint }[]>(
      `SELECT nextval('${SERVICE_CODE_SEQUENCE}') AS nextval`,
    );
    return rows[0]!.nextval;
  }

  it('never issues the same value twice under concurrent allocation', async () => {
    // SRS 26.6: "Two Drivers/users can submit at approximately the same time
    // ... Each receives a unique service record/Service ID."
    const values = await Promise.all(Array.from({ length: 50 }, nextSequenceValue));

    expect(new Set(values.map(String)).size).toBe(50);
  });

  it('produces a unique service code for each allocated value', async () => {
    const codes = await Promise.all(
      Array.from({ length: 20 }, async () => formatServiceCode(await nextSequenceValue())),
    );

    expect(new Set(codes).size).toBe(20);
    expect(codes[0]).toMatch(/^[1-9]\d*$/);
  });

  it('starts at 1 so the client’s numbering can be continued with setval', async () => {
    // The sequence is reset by the suite's TRUNCATE ... RESTART IDENTITY, so
    // the first value here is the value a fresh deployment would issue. Before
    // go-live it is advanced past the highest ID in 01Servicios.
    expect(await nextSequenceValue()).toBe(1n);
  });

  it('rejects a duplicate service code even if the sequence were bypassed', async () => {
    await prisma.service.create({ data: serviceData(fixture, { serviceCode: '1247' }) });

    await expect(
      prisma.service.create({ data: serviceData(fixture, { serviceCode: '1247' }) }),
    ).rejects.toThrow(/services_service_code_key/);
  });
});

describe('departure and arrival ordering (client decision #3)', () => {
  it('accepts a normal same-day service', async () => {
    await expect(
      prisma.service.create({
        data: serviceData(fixture, {
          departureTime: timeOfDayToDate(asTimeOfDay('07:45')),
          arrivalTime: timeOfDayToDate(asTimeOfDay('15:30')),
          endsNextDay: false,
        }),
      }),
    ).resolves.toBeDefined();
  });

  it('rejects a same-day service whose arrival precedes its departure', async () => {
    // The transposition typo the client asked us to catch. The database
    // refuses it even though the write skips every application-level check.
    await expect(
      prisma.service.create({
        data: serviceData(fixture, {
          departureTime: timeOfDayToDate(asTimeOfDay('15:30')),
          arrivalTime: timeOfDayToDate(asTimeOfDay('07:45')),
          endsNextDay: false,
        }),
      }),
    ).rejects.toThrow(/services_times_consistent/);
  });

  it('rejects a same-day service that arrives at its departure time', async () => {
    await expect(
      prisma.service.create({
        data: serviceData(fixture, {
          departureTime: timeOfDayToDate(asTimeOfDay('07:45')),
          arrivalTime: timeOfDayToDate(asTimeOfDay('07:45')),
          endsNextDay: false,
        }),
      }),
    ).rejects.toThrow(/services_times_consistent/);
  });

  it('accepts an overnight service when the flag is set (SRS 31.3)', async () => {
    const service = await prisma.service.create({
      data: serviceData(fixture, {
        departureTime: timeOfDayToDate(asTimeOfDay('22:00')),
        arrivalTime: timeOfDayToDate(asTimeOfDay('02:00')),
        endsNextDay: true,
      }),
    });

    expect(service.endsNextDay).toBe(true);
    expect(dateToTimeOfDay(service.arrivalTime)).toBe('02:00');
  });

  it('rejects an overnight flag that would make the service 24 hours or more', async () => {
    await expect(
      prisma.service.create({
        data: serviceData(fixture, {
          departureTime: timeOfDayToDate(asTimeOfDay('07:00')),
          arrivalTime: timeOfDayToDate(asTimeOfDay('09:00')),
          endsNextDay: true,
        }),
      }),
    ).rejects.toThrow(/services_times_consistent/);
  });

  it('defaults endsNextDay to false, so the same-day rule applies by default', async () => {
    const service = await prisma.service.create({ data: serviceData(fixture) });

    expect(service.endsNextDay).toBe(false);
  });
});

describe('rate constraints (client change request 2026-09-09, ERP roadmap Phase 0)', () => {
  it('allows a route with no default rate', async () => {
    const route = await prisma.route.findUniqueOrThrow({ where: { id: fixture.routeId } });

    expect(route.defaultRateCents).toBeNull();
  });

  it('allows a route with a non-negative default rate', async () => {
    const route = await prisma.route.update({
      where: { id: fixture.routeId },
      data: { defaultRateCents: 18_000 },
    });

    expect(route.defaultRateCents).toBe(18_000);
  });

  it('allows a route default rate of exactly zero', async () => {
    const route = await prisma.route.update({
      where: { id: fixture.routeId },
      data: { defaultRateCents: 0 },
    });

    expect(route.defaultRateCents).toBe(0);
  });

  it('rejects a negative route default rate', async () => {
    await expect(
      prisma.route.update({
        where: { id: fixture.routeId },
        data: { defaultRateCents: -1 },
      }),
    ).rejects.toThrow(/routes_default_rate_non_negative/);
  });

  it('allows a service with no rate', async () => {
    const service = await prisma.service.create({ data: serviceData(fixture) });

    expect(service.rateCents).toBeNull();
  });

  it('allows a service with a non-negative rate, independent of the route default', async () => {
    // The rate is a snapshot taken at creation (SRS 14.5's pattern, reused) -
    // it need not equal the route's current default, so this asserts the
    // column accepts any non-negative value on its own terms.
    await prisma.route.update({
      where: { id: fixture.routeId },
      data: { defaultRateCents: 18_000 },
    });

    const service = await prisma.service.create({
      data: serviceData(fixture, { rateCents: 21_000 }),
    });

    expect(service.rateCents).toBe(21_000);
  });

  it('rejects a negative service rate', async () => {
    await expect(
      prisma.service.create({ data: serviceData(fixture, { rateCents: -500 }) }),
    ).rejects.toThrow(/services_rate_non_negative/);
  });

  it('allows clearing a service rate back to null on edit', async () => {
    const service = await prisma.service.create({
      data: serviceData(fixture, { rateCents: 21_000 }),
    });

    const cleared = await prisma.service.update({
      where: { id: service.id },
      data: { rateCents: null },
    });

    expect(cleared.rateCents).toBeNull();
  });
});

describe('finance-core master data constraints (ERP roadmap Phase 1)', () => {
  it('rejects a duplicate name within the same lookup kind', async () => {
    await prisma.lookupItem.create({ data: { kind: 'FUEL_TYPE', name: 'Diésel' } });

    await expect(
      prisma.lookupItem.create({ data: { kind: 'FUEL_TYPE', name: 'Diésel' } }),
    ).rejects.toThrow(/lookup_items_kind_name_key/);
  });

  it('allows the same name in two different lookup kinds', async () => {
    await prisma.lookupItem.create({ data: { kind: 'FUEL_TYPE', name: 'Efectivo' } });

    await expect(
      prisma.lookupItem.create({ data: { kind: 'PAYMENT_METHOD', name: 'Efectivo' } }),
    ).resolves.toBeDefined();
  });

  it('seeds exactly one app_config row, at the fixed id "default"', async () => {
    const rows = await prisma.appConfig.findMany();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('default');
  });

  it('rejects a zero or negative oil-change interval', async () => {
    await expect(
      prisma.appConfig.update({
        where: { id: 'default' },
        data: { oilChangeIntervalKm: 0 },
      }),
    ).rejects.toThrow(/app_config_positive_defaults/);
  });

  it('rejects a zero or negative default consumption', async () => {
    await expect(
      prisma.appConfig.update({
        where: { id: 'default' },
        data: { defaultConsumptionMlPer100Km: -1 },
      }),
    ).rejects.toThrow(/app_config_positive_defaults/);
  });

  it('allows a zero fuel price but rejects a negative one', async () => {
    await expect(
      prisma.appConfig.update({
        where: { id: 'default' },
        data: { defaultFuelPriceCentsPerLiter: 0 },
      }),
    ).resolves.toBeDefined();

    await expect(
      prisma.appConfig.update({
        where: { id: 'default' },
        data: { defaultFuelPriceCentsPerLiter: -1 },
      }),
    ).rejects.toThrow(/app_config_positive_defaults/);
  });
});
