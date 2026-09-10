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

describe('refuelling constraints (ERP roadmap Phase 2)', () => {
  /** A valid refuelling payload; individual tests override the field under test. */
  function refuellingData(fixture: Fixture, overrides: Record<string, unknown> = {}) {
    return {
      refuelCode: String(Math.floor(Math.random() * 1e9)),
      vehicleId: fixture.vehicleId,
      driverId: fixture.driverId,
      refuelDate: new Date('2026-09-02T00:00:00.000Z'),
      odometerKm: 10_000,
      litersMl: 45_000,
      totalCents: 7_200,
      vatRate: 'STANDARD' as const,
      baseCents: 5_950,
      vatCents: 1_250,
      ...overrides,
    };
  }

  it('accepts a correctly balanced base/VAT split', async () => {
    const refuelling = await prisma.refuelling.create({ data: refuellingData(fixture) });

    expect(refuelling.baseCents + refuelling.vatCents).toBe(refuelling.totalCents);
  });

  it('rejects a base/VAT split that does not sum to the total', async () => {
    await expect(
      prisma.refuelling.create({
        data: refuellingData(fixture, { baseCents: 5_950, vatCents: 1_000 }),
      }),
    ).rejects.toThrow(/refuellings_base_vat_sum/);
  });

  it('rejects a negative odometer reading', async () => {
    await expect(
      prisma.refuelling.create({ data: refuellingData(fixture, { odometerKm: -1 }) }),
    ).rejects.toThrow(/refuellings_odometer_non_negative/);
  });

  it('rejects zero or negative litres', async () => {
    await expect(
      prisma.refuelling.create({ data: refuellingData(fixture, { litersMl: 0 }) }),
    ).rejects.toThrow(/refuellings_liters_positive/);
  });

  it('rejects a negative total', async () => {
    await expect(
      prisma.refuelling.create({
        data: refuellingData(fixture, { totalCents: -100, baseCents: -100, vatCents: 0 }),
      }),
    ).rejects.toThrow(/refuellings_total_non_negative/);
  });

  it('rejects a duplicate refuel code even if the sequence were bypassed', async () => {
    await prisma.refuelling.create({ data: refuellingData(fixture, { refuelCode: '9999' }) });

    await expect(
      prisma.refuelling.create({ data: refuellingData(fixture, { refuelCode: '9999' }) }),
    ).rejects.toThrow(/refuellings_refuel_code_key/);
  });

  it('refuses to delete a vehicle referenced by a refuelling', async () => {
    await prisma.refuelling.create({ data: refuellingData(fixture) });

    await expect(prisma.vehicle.delete({ where: { id: fixture.vehicleId } })).rejects.toThrow();
  });

  it('refuses to delete a lookup item referenced as a fuel type', async () => {
    const fuelType = await prisma.lookupItem.create({
      data: { kind: 'FUEL_TYPE', name: 'Diésel' },
    });
    await prisma.refuelling.create({
      data: refuellingData(fixture, { fuelTypeId: fuelType.id }),
    });

    await expect(prisma.lookupItem.delete({ where: { id: fuelType.id } })).rejects.toThrow();
  });
});

describe('received invoice constraints (ERP roadmap Phase 3)', () => {
  async function receivedInvoiceFixture() {
    const supplier = await prisma.supplier.create({ data: { name: 'Taller Ejemplo SL' } });
    const category = await prisma.expenseCategory.create({
      data: { name: 'Reparaciones', expenseType: 'OPERATION', defaultVatRate: 'STANDARD' },
    });
    return { supplierId: supplier.id, categoryId: category.id };
  }

  /** A valid received-invoice payload; individual tests override the field under test. */
  function receivedInvoiceData(
    supplierId: string,
    categoryId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      invoiceCode: String(Math.floor(Math.random() * 1e9)),
      supplierId,
      categoryId,
      invoiceDate: new Date('2026-09-02T00:00:00.000Z'),
      baseCents: 10_000,
      vatRate: 'STANDARD' as const,
      vatCents: 2_100,
      totalCents: 12_100,
      ...overrides,
    };
  }

  it('accepts a correctly balanced base/VAT split', async () => {
    const { supplierId, categoryId } = await receivedInvoiceFixture();

    const invoice = await prisma.receivedInvoice.create({
      data: receivedInvoiceData(supplierId, categoryId),
    });

    expect(invoice.baseCents + invoice.vatCents).toBe(invoice.totalCents);
  });

  it('rejects a base/VAT split that does not sum to the total', async () => {
    const { supplierId, categoryId } = await receivedInvoiceFixture();

    await expect(
      prisma.receivedInvoice.create({
        data: receivedInvoiceData(supplierId, categoryId, { vatCents: 1_000 }),
      }),
    ).rejects.toThrow(/received_invoices_vat_sum/);
  });

  it('rejects a negative taxable base', async () => {
    const { supplierId, categoryId } = await receivedInvoiceFixture();

    await expect(
      prisma.receivedInvoice.create({
        data: receivedInvoiceData(supplierId, categoryId, {
          baseCents: -100,
          vatCents: -21,
          totalCents: -121,
        }),
      }),
    ).rejects.toThrow(/received_invoices_base_non_negative/);
  });

  it('rejects a duplicate invoice code even if the sequence were bypassed', async () => {
    const { supplierId, categoryId } = await receivedInvoiceFixture();

    await prisma.receivedInvoice.create({
      data: receivedInvoiceData(supplierId, categoryId, { invoiceCode: '9999' }),
    });

    await expect(
      prisma.receivedInvoice.create({
        data: receivedInvoiceData(supplierId, categoryId, { invoiceCode: '9999' }),
      }),
    ).rejects.toThrow(/received_invoices_invoice_code_key/);
  });

  it('refuses to delete a supplier referenced by an invoice', async () => {
    const { supplierId, categoryId } = await receivedInvoiceFixture();
    await prisma.receivedInvoice.create({ data: receivedInvoiceData(supplierId, categoryId) });

    await expect(prisma.supplier.delete({ where: { id: supplierId } })).rejects.toThrow();
  });

  it('refuses to delete a category referenced by an invoice', async () => {
    const { supplierId, categoryId } = await receivedInvoiceFixture();
    await prisma.receivedInvoice.create({ data: receivedInvoiceData(supplierId, categoryId) });

    await expect(prisma.expenseCategory.delete({ where: { id: categoryId } })).rejects.toThrow();
  });

  it('allows an invoice with no vehicle - not every expense is vehicle-specific', async () => {
    const { supplierId, categoryId } = await receivedInvoiceFixture();

    const invoice = await prisma.receivedInvoice.create({
      data: receivedInvoiceData(supplierId, categoryId),
    });

    expect(invoice.vehicleId).toBeNull();
  });
});

describe('service billing constraints (ERP roadmap Phase 4)', () => {
  it('rejects a negative supplement', async () => {
    await expect(
      prisma.service.create({
        data: serviceData(fixture, { rateCents: 18_000, supplementCents: -100, baseCents: 17_900 }),
      }),
    ).rejects.toThrow(/services_supplement_non_negative/);
  });

  it('rejects a base that does not equal rate plus supplement', async () => {
    await expect(
      prisma.service.create({
        data: serviceData(fixture, { rateCents: 18_000, supplementCents: 2_000, baseCents: 19_000 }),
      }),
    ).rejects.toThrow(/services_base_formula/);
  });

  it('accepts a base that correctly sums rate and supplement', async () => {
    const service = await prisma.service.create({
      data: serviceData(fixture, { rateCents: 18_000, supplementCents: 2_000, baseCents: 20_000 }),
    });

    expect(service.baseCents).toBe(20_000);
  });

  it('rejects a base with no rate behind it', async () => {
    await expect(
      prisma.service.create({
        data: serviceData(fixture, { rateCents: null, baseCents: 5_000 }),
      }),
    ).rejects.toThrow(/services_base_formula/);
  });

  it('allows no rate and no base together', async () => {
    const service = await prisma.service.create({
      data: serviceData(fixture, { rateCents: null, baseCents: null }),
    });

    expect(service.baseCents).toBeNull();
  });

  it('refuses to link a pending service to an issued invoice', async () => {
    const client = await prisma.client.create({ data: { name: 'Cliente Ejemplo' } });
    const invoice = await prisma.issuedInvoice.create({
      data: {
        invoiceCode: 'FE-TEST-1',
        clientId: client.id,
        invoiceDate: new Date('2026-09-02T00:00:00.000Z'),
        baseCents: 18_000,
        vatRate: 'STANDARD',
        vatCents: 3_780,
        totalCents: 21_780,
      },
    });

    await expect(
      prisma.service.create({
        data: serviceData(fixture, {
          rateCents: 18_000,
          baseCents: 18_000,
          issuedInvoiceId: invoice.id,
          // Still Pending - the default `serviceData` status.
        }),
      }),
    ).rejects.toThrow(/services_issued_invoice_requires_billable/);
  });

  it('refuses to link an approved service with no base', async () => {
    const client = await prisma.client.create({ data: { name: 'Cliente Ejemplo' } });
    const invoice = await prisma.issuedInvoice.create({
      data: {
        invoiceCode: 'FE-TEST-2',
        clientId: client.id,
        invoiceDate: new Date('2026-09-02T00:00:00.000Z'),
        baseCents: 18_000,
        vatRate: 'STANDARD',
        vatCents: 3_780,
        totalCents: 21_780,
      },
    });

    await expect(
      prisma.service.create({
        data: serviceData(fixture, {
          status: ServiceStatus.APPROVED,
          approvedAt: new Date(),
          approvedByUserId: fixture.adminId,
          rateCents: null,
          baseCents: null,
          issuedInvoiceId: invoice.id,
        }),
      }),
    ).rejects.toThrow(/services_issued_invoice_requires_billable/);
  });

  it('allows linking an approved, priced service to an issued invoice', async () => {
    const client = await prisma.client.create({ data: { name: 'Cliente Ejemplo' } });
    const invoice = await prisma.issuedInvoice.create({
      data: {
        invoiceCode: 'FE-TEST-3',
        clientId: client.id,
        invoiceDate: new Date('2026-09-02T00:00:00.000Z'),
        baseCents: 18_000,
        vatRate: 'STANDARD',
        vatCents: 3_780,
        totalCents: 21_780,
      },
    });

    const service = await prisma.service.create({
      data: serviceData(fixture, {
        status: ServiceStatus.APPROVED,
        approvedAt: new Date(),
        approvedByUserId: fixture.adminId,
        rateCents: 18_000,
        baseCents: 18_000,
        issuedInvoiceId: invoice.id,
      }),
    });

    expect(service.issuedInvoiceId).toBe(invoice.id);
  });

  it('refuses to delete a lookup item referenced as a supplement type', async () => {
    const supplementType = await prisma.lookupItem.create({
      data: { kind: 'SUPPLEMENT_TYPE', name: 'Espera' },
    });
    await prisma.service.create({
      data: serviceData(fixture, {
        rateCents: 18_000,
        supplementCents: 1_000,
        baseCents: 19_000,
        supplementTypeId: supplementType.id,
      }),
    });

    await expect(
      prisma.lookupItem.delete({ where: { id: supplementType.id } }),
    ).rejects.toThrow();
  });

  it('refuses to delete a client referenced by a route', async () => {
    const client = await prisma.client.create({ data: { name: 'Cliente con ruta' } });
    await prisma.route.update({ where: { id: fixture.routeId }, data: { clientId: client.id } });

    await expect(prisma.client.delete({ where: { id: client.id } })).rejects.toThrow();
  });

  it('un-bills every service automatically when its issued invoice is deleted', async () => {
    const client = await prisma.client.create({ data: { name: 'Cliente Ejemplo' } });
    const invoice = await prisma.issuedInvoice.create({
      data: {
        invoiceCode: 'FE-TEST-4',
        clientId: client.id,
        invoiceDate: new Date('2026-09-02T00:00:00.000Z'),
        baseCents: 18_000,
        vatRate: 'STANDARD',
        vatCents: 3_780,
        totalCents: 21_780,
      },
    });
    const service = await prisma.service.create({
      data: serviceData(fixture, {
        status: ServiceStatus.APPROVED,
        approvedAt: new Date(),
        approvedByUserId: fixture.adminId,
        rateCents: 18_000,
        baseCents: 18_000,
        issuedInvoiceId: invoice.id,
      }),
    });

    // SetNull, not Restrict - the invoice can be deleted outright.
    await prisma.issuedInvoice.delete({ where: { id: invoice.id } });

    const reloaded = await prisma.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(reloaded.issuedInvoiceId).toBeNull();
  });
});

describe('issued invoice constraints (ERP roadmap Phase 4)', () => {
  async function issuedInvoiceFixture() {
    const client = await prisma.client.create({ data: { name: 'Cliente Ejemplo' } });
    return { clientId: client.id };
  }

  function issuedInvoiceData(clientId: string, overrides: Record<string, unknown> = {}) {
    return {
      invoiceCode: String(Math.floor(Math.random() * 1e9)),
      clientId,
      invoiceDate: new Date('2026-09-02T00:00:00.000Z'),
      baseCents: 10_000,
      vatRate: 'STANDARD' as const,
      vatCents: 2_100,
      totalCents: 12_100,
      ...overrides,
    };
  }

  it('accepts a correctly balanced base/VAT split', async () => {
    const { clientId } = await issuedInvoiceFixture();

    const invoice = await prisma.issuedInvoice.create({ data: issuedInvoiceData(clientId) });

    expect(invoice.baseCents + invoice.vatCents).toBe(invoice.totalCents);
  });

  it('rejects a base/VAT split that does not sum to the total', async () => {
    const { clientId } = await issuedInvoiceFixture();

    await expect(
      prisma.issuedInvoice.create({ data: issuedInvoiceData(clientId, { vatCents: 1_000 }) }),
    ).rejects.toThrow(/issued_invoices_vat_sum/);
  });

  it('rejects a negative taxable base', async () => {
    const { clientId } = await issuedInvoiceFixture();

    await expect(
      prisma.issuedInvoice.create({
        data: issuedInvoiceData(clientId, { baseCents: -100, vatCents: -21, totalCents: -121 }),
      }),
    ).rejects.toThrow(/issued_invoices_base_non_negative/);
  });

  it('rejects a duplicate invoice code even if the sequence were bypassed', async () => {
    const { clientId } = await issuedInvoiceFixture();

    await prisma.issuedInvoice.create({
      data: issuedInvoiceData(clientId, { invoiceCode: '9999' }),
    });

    await expect(
      prisma.issuedInvoice.create({ data: issuedInvoiceData(clientId, { invoiceCode: '9999' }) }),
    ).rejects.toThrow(/issued_invoices_invoice_code_key/);
  });

  it('refuses to delete a client referenced by an issued invoice', async () => {
    const { clientId } = await issuedInvoiceFixture();
    await prisma.issuedInvoice.create({ data: issuedInvoiceData(clientId) });

    await expect(prisma.client.delete({ where: { id: clientId } })).rejects.toThrow();
  });
});

describe('fleet and personnel log constraints (ERP roadmap Phase 5)', () => {
  describe('daily km logs', () => {
    function dailyKmLogData(fixture: Fixture, overrides: Record<string, unknown> = {}) {
      return {
        vehicleId: fixture.vehicleId,
        date: new Date('2026-09-02T00:00:00.000Z'),
        actualKm: 100,
        ...overrides,
      };
    }

    it('accepts a valid log', async () => {
      const log = await prisma.dailyKmLog.create({ data: dailyKmLogData(fixture) });

      expect(log.actualKm).toBe(100);
    });

    it('rejects a negative actual km', async () => {
      await expect(
        prisma.dailyKmLog.create({ data: dailyKmLogData(fixture, { actualKm: -1 }) }),
      ).rejects.toThrow(/daily_km_logs_km_non_negative/);
    });

    it('rejects negative worked minutes', async () => {
      await expect(
        prisma.dailyKmLog.create({
          data: dailyKmLogData(fixture, { workedMinutes: -1 }),
        }),
      ).rejects.toThrow(/daily_km_logs_worked_minutes_non_negative/);
    });

    it('rejects a second log for the same vehicle on the same day', async () => {
      await prisma.dailyKmLog.create({ data: dailyKmLogData(fixture) });

      await expect(prisma.dailyKmLog.create({ data: dailyKmLogData(fixture) })).rejects.toThrow(
        /daily_km_logs_vehicle_id_date_key/,
      );
    });

    it('refuses to delete a vehicle referenced by a daily km log', async () => {
      await prisma.dailyKmLog.create({ data: dailyKmLogData(fixture) });

      await expect(prisma.vehicle.delete({ where: { id: fixture.vehicleId } })).rejects.toThrow();
    });

    it('refuses to delete a driver referenced by a daily km log', async () => {
      await prisma.dailyKmLog.create({
        data: dailyKmLogData(fixture, { driverId: fixture.driverId }),
      });

      await expect(prisma.user.delete({ where: { id: fixture.driverId } })).rejects.toThrow();
    });
  });

  describe('personnel costs', () => {
    function personnelCostData(fixture: Fixture, overrides: Record<string, unknown> = {}) {
      return {
        userId: fixture.driverId,
        year: 2026,
        month: 9,
        baseCents: 150_000,
        overtimeCents: 10_000,
        allowancesCents: 5_000,
        otherCents: 0,
        totalCents: 165_000,
        ...overrides,
      };
    }

    it('accepts a correctly summed total', async () => {
      const cost = await prisma.personnelCost.create({ data: personnelCostData(fixture) });

      expect(cost.totalCents).toBe(165_000);
    });

    it('rejects a total that does not equal base + overtime + allowances + other', async () => {
      await expect(
        prisma.personnelCost.create({
          data: personnelCostData(fixture, { totalCents: 100_000 }),
        }),
      ).rejects.toThrow(/personnel_costs_total_formula/);
    });

    it('rejects a negative amount', async () => {
      await expect(
        prisma.personnelCost.create({
          data: personnelCostData(fixture, { baseCents: -1, totalCents: 164_999 }),
        }),
      ).rejects.toThrow(/personnel_costs_amounts_non_negative/);
    });

    it('rejects a month outside 1-12', async () => {
      await expect(
        prisma.personnelCost.create({ data: personnelCostData(fixture, { month: 13 }) }),
      ).rejects.toThrow(/personnel_costs_month_range/);
    });

    it('rejects a second cost for the same user/year/month', async () => {
      await prisma.personnelCost.create({ data: personnelCostData(fixture) });

      await expect(
        prisma.personnelCost.create({ data: personnelCostData(fixture) }),
      ).rejects.toThrow(/personnel_costs_user_id_year_month_key/);
    });

    it('refuses to delete a user referenced by a personnel cost', async () => {
      await prisma.personnelCost.create({ data: personnelCostData(fixture) });

      await expect(prisma.user.delete({ where: { id: fixture.driverId } })).rejects.toThrow();
    });
  });

  describe('maintenance records', () => {
    async function maintenanceTypeFixture() {
      const type = await prisma.lookupItem.create({
        data: { kind: 'MAINTENANCE_TYPE', name: 'Cambio de aceite' },
      });
      return type.id;
    }

    function maintenanceRecordData(
      fixture: Fixture,
      maintenanceTypeId: string,
      overrides: Record<string, unknown> = {},
    ) {
      return {
        maintenanceCode: String(Math.floor(Math.random() * 1e9)),
        vehicleId: fixture.vehicleId,
        maintenanceTypeId,
        performedDate: new Date('2026-09-02T00:00:00.000Z'),
        ...overrides,
      };
    }

    it('accepts a valid record', async () => {
      const maintenanceTypeId = await maintenanceTypeFixture();

      const record = await prisma.maintenanceRecord.create({
        data: maintenanceRecordData(fixture, maintenanceTypeId, { performedKm: 50_000 }),
      });

      expect(record.performedKm).toBe(50_000);
    });

    it('rejects a negative performed km', async () => {
      const maintenanceTypeId = await maintenanceTypeFixture();

      await expect(
        prisma.maintenanceRecord.create({
          data: maintenanceRecordData(fixture, maintenanceTypeId, { performedKm: -1 }),
        }),
      ).rejects.toThrow(/maintenance_records_km_non_negative/);
    });

    it('rejects a negative next-due km', async () => {
      const maintenanceTypeId = await maintenanceTypeFixture();

      await expect(
        prisma.maintenanceRecord.create({
          data: maintenanceRecordData(fixture, maintenanceTypeId, { nextDueKm: -1 }),
        }),
      ).rejects.toThrow(/maintenance_records_km_non_negative/);
    });

    it('rejects a duplicate maintenance code even if the sequence were bypassed', async () => {
      const maintenanceTypeId = await maintenanceTypeFixture();

      await prisma.maintenanceRecord.create({
        data: maintenanceRecordData(fixture, maintenanceTypeId, { maintenanceCode: '9999' }),
      });

      await expect(
        prisma.maintenanceRecord.create({
          data: maintenanceRecordData(fixture, maintenanceTypeId, { maintenanceCode: '9999' }),
        }),
      ).rejects.toThrow(/maintenance_records_maintenance_code_key/);
    });

    it('refuses to delete a vehicle referenced by a maintenance record', async () => {
      const maintenanceTypeId = await maintenanceTypeFixture();
      await prisma.maintenanceRecord.create({
        data: maintenanceRecordData(fixture, maintenanceTypeId),
      });

      await expect(prisma.vehicle.delete({ where: { id: fixture.vehicleId } })).rejects.toThrow();
    });

    it('refuses to delete a lookup item referenced as a maintenance type', async () => {
      const maintenanceTypeId = await maintenanceTypeFixture();
      await prisma.maintenanceRecord.create({
        data: maintenanceRecordData(fixture, maintenanceTypeId),
      });

      await expect(
        prisma.lookupItem.delete({ where: { id: maintenanceTypeId } }),
      ).rejects.toThrow();
    });
  });
});
