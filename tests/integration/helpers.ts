/**
 * Fixtures for the service-layer integration tests.
 *
 * These tests exercise the real service layer against the real database. What
 * they stub is authentication only — `requireUser` reads a session, and there
 * is no browser here — so an `Actor` is constructed directly from a seeded row.
 *
 * That is the right seam. Everything below the session (ownership scoping,
 * status gates, transactions, audit writes, constraints) runs for real, which
 * is what makes these tests evidence for SRS 26.4 and 26.8 rather than a
 * restatement of the unit suite.
 */
import { Role, ServiceStatus } from '@prisma/client';

import type { Actor } from '@/lib/auth/session';
import { asTimeOfDay } from '@/lib/time/time-of-day';
import type { CreateServiceInput } from '@/modules/services/schemas/service.schema';

import { testPrisma as prisma } from './setup';

/** An Argon2id-shaped string. Nothing in these tests verifies it. */
export const TEST_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNoaGFzaA';

export interface Fixture {
  admin: Actor;
  driver: Actor;
  otherDriver: Actor;
  vehicleId: string;
  /** A second active vehicle, so deactivating the default leaves a choice. */
  spareVehicleId: string;
  inactiveVehicleId: string;
  routeId: string;
  otherRouteId: string;
  unassignedRouteId: string;
  inactiveRouteId: string;
}

/**
 * A realistic starting state: two drivers with different configurations, an
 * administrator, and master data covering the active and inactive cases every
 * rule in SRS 13.4 and 14.3 turns on.
 */
export async function seedFixture(): Promise<Fixture> {
  const [vehicle, spareVehicle, inactiveVehicle] = await Promise.all([
    prisma.vehicle.create({
      data: { registrationPlate: '1234 ABC', referenceName: 'Unidad 1' },
    }),
    prisma.vehicle.create({
      data: { registrationPlate: '5678 DEF', referenceName: 'Unidad 2' },
    }),
    prisma.vehicle.create({
      data: { registrationPlate: '9012 GHI', referenceName: 'Retirado', isActive: false },
    }),
  ]);

  const [route, otherRoute, unassignedRoute, inactiveRoute] = await Promise.all([
    prisma.route.create({
      data: {
        code: 'MAD-BCN-01',
        name: 'Madrid - Barcelona',
        origin: 'Madrid Sur',
        destination: 'Barcelona Zona Franca',
      },
    }),
    prisma.route.create({
      data: {
        code: 'MAD-VAL-02',
        name: 'Madrid - Valencia',
        origin: 'Madrid Sur',
        destination: 'Valencia Puerto',
      },
    }),
    prisma.route.create({
      data: {
        code: 'MAD-SEV-04',
        name: 'Madrid - Sevilla',
        origin: 'Madrid Sur',
        destination: 'Sevilla',
      },
    }),
    prisma.route.create({
      data: {
        code: 'ANT-99',
        name: 'Contrato finalizado',
        origin: 'Getafe',
        destination: 'Toledo',
        isActive: false,
      },
    }),
  ]);

  const [adminUser, driverUser, otherDriverUser] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Administrador',
        loginIdentifier: 'admin',
        passwordHash: TEST_HASH,
        role: Role.ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Ana García',
        loginIdentifier: 'conductor1',
        passwordHash: TEST_HASH,
        role: Role.DRIVER,
        defaultVehicleId: vehicle.id,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Bruno Martín',
        loginIdentifier: 'conductor2',
        passwordHash: TEST_HASH,
        role: Role.DRIVER,
      },
    }),
  ]);

  await prisma.driverRoute.createMany({
    data: [
      { driverId: driverUser.id, routeId: route.id, isDefault: true },
      { driverId: driverUser.id, routeId: otherRoute.id, isDefault: false },
      { driverId: driverUser.id, routeId: inactiveRoute.id, isDefault: false },
      { driverId: otherDriverUser.id, routeId: route.id, isDefault: true },
    ],
  });

  return {
    admin: { userId: adminUser.id, name: adminUser.name, role: Role.ADMIN },
    driver: { userId: driverUser.id, name: driverUser.name, role: Role.DRIVER },
    otherDriver: {
      userId: otherDriverUser.id,
      name: otherDriverUser.name,
      role: Role.DRIVER,
    },
    vehicleId: vehicle.id,
    spareVehicleId: spareVehicle.id,
    inactiveVehicleId: inactiveVehicle.id,
    routeId: route.id,
    otherRouteId: otherRoute.id,
    unassignedRouteId: unassignedRoute.id,
    inactiveRouteId: inactiveRoute.id,
  };
}

/** A valid Add Service body; tests override the field under examination. */
export function serviceBody(
  fixture: Fixture,
  overrides: Partial<CreateServiceInput> = {},
): CreateServiceInput {
  return {
    vehicleId: fixture.vehicleId,
    routeId: fixture.routeId,
    startDashboardKm: 10_000,
    startBaseKm: 10_020,
    endBaseKm: 10_080,
    endDashboardKm: 10_100,
    departureTime: asTimeOfDay('07:45'),
    arrivalTime: asTimeOfDay('15:30'),
    endsNextDay: false,
    ...overrides,
  } as CreateServiceInput;
}

export { prisma, Role, ServiceStatus };
