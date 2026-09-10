/**
 * Request-schema behaviour (SRS 22.4, 24.1, 25, 26.8).
 *
 * The security tests in SRS 26.8 - "role escalation through modified requests
 * fails", "driver ID substitution fails" - start here. A payload that tries to
 * set a server-owned field must be rejected at the schema boundary, before any
 * handler has a chance to spread it into a Prisma call.
 */
import { describe, expect, it } from 'vitest';

import {
  adminCreateServiceSchema,
  approveServiceSchema,
  createServiceSchema,
  serviceFilterSchema,
} from '@/modules/services/schemas/service.schema';
import {
  createUserSchema,
  loginIdentifierSchema,
  passwordSchema,
  replaceRouteAssignmentsSchema,
} from '@/modules/users/schemas/user.schema';
import { createVehicleSchema } from '@/modules/vehicles/schemas/vehicle.schema';
import { createRouteSchema } from '@/modules/routes/schemas/route.schema';

const VEHICLE_ID = '0199a1b2-c3d4-7000-8000-000000000001';
const ROUTE_ID = '0199a1b2-c3d4-7000-8000-000000000002';
const OTHER_ROUTE_ID = '0199a1b2-c3d4-7000-8000-000000000003';

const validService = {
  vehicleId: VEHICLE_ID,
  routeId: ROUTE_ID,
  startDashboardKm: 10_000,
  startBaseKm: 10_020,
  endBaseKm: 10_080,
  endDashboardKm: 10_100,
  departureTime: '07:45',
  arrivalTime: '15:30',
};

/** The field paths a failed parse complained about. */
function errorPaths(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}) {
  return (result.error?.issues ?? []).map((issue) => issue.path.join('.'));
}

describe('createServiceSchema — accepted input', () => {
  it('accepts the six mandatory fields with both optional fields absent (SRS 9.4)', () => {
    const result = createServiceSchema.safeParse(validService);

    expect(result.success).toBe(true);
    expect(result.data?.sites).toBeUndefined();
    expect(result.data?.observations).toBeUndefined();
  });

  it('treats a blank optional field as absent rather than as empty text', () => {
    const result = createServiceSchema.safeParse({
      ...validService,
      sites: '   ',
      observations: '',
    });

    expect(result.success).toBe(true);
    // Storing "" alongside NULL for "nothing entered" would make every later
    // query ambiguous.
    expect(result.data?.sites).toBeUndefined();
    expect(result.data?.observations).toBeUndefined();
  });

  it('trims surrounding whitespace from optional text', () => {
    const result = createServiceSchema.safeParse({
      ...validService,
      sites: '  Warehouse 4, Bay 12  ',
    });

    expect(result.data?.sites).toBe('Warehouse 4, Bay 12');
  });

  it('accepts numeric strings from an HTML number input', () => {
    const result = createServiceSchema.safeParse({
      ...validService,
      startDashboardKm: '10000',
    });

    expect(result.success).toBe(true);
    expect(result.data?.startDashboardKm).toBe(10_000);
  });
});

describe('createServiceSchema — rejected input', () => {
  it('requires every one of the six mandatory fields (SRS 9.3)', () => {
    const result = createServiceSchema.safeParse({ vehicleId: VEHICLE_ID, routeId: ROUTE_ID });
    const paths = errorPaths(result);

    for (const field of [
      'startDashboardKm',
      'startBaseKm',
      'endBaseKm',
      'endDashboardKm',
      'departureTime',
      'arrivalTime',
    ]) {
      expect(paths).toContain(field);
    }
  });

  it('does not coerce an empty mileage field to zero', () => {
    // `Number("")` is 0. Coercing here would record a missing reading as a
    // valid zero and pass every ordering check.
    const result = createServiceSchema.safeParse({ ...validService, startBaseKm: '' });

    expect(result.success).toBe(false);
    expect(errorPaths(result)).toContain('startBaseKm');
  });

  it('applies the mileage sequence rule from the domain layer (SRS 10.3)', () => {
    const result = createServiceSchema.safeParse({ ...validService, endBaseKm: 9_000 });

    expect(result.success).toBe(false);
    expect(errorPaths(result)).toContain('endBaseKm');
  });

  it('applies the client tightening: no zero-distance service (decision #4)', () => {
    const result = createServiceSchema.safeParse({ ...validService, endBaseKm: 10_020 });

    expect(result.success).toBe(false);
    expect(errorPaths(result)).toContain('endBaseKm');
  });

  it('applies the same-day time rule from the domain layer (decision #3)', () => {
    const result = createServiceSchema.safeParse({
      ...validService,
      departureTime: '15:30',
      arrivalTime: '07:45',
    });

    expect(result.success).toBe(false);
    expect(errorPaths(result)).toContain('arrivalTime');
  });

  it('accepts the same times when the service is flagged as overnight', () => {
    const result = createServiceSchema.safeParse({
      ...validService,
      departureTime: '22:00',
      arrivalTime: '02:00',
      endsNextDay: true,
    });

    expect(result.success).toBe(true);
  });

  it('accepts any arrival time on a next-day service (change request 2026-09-09)', () => {
    const result = createServiceSchema.safeParse({
      ...validService,
      departureTime: '08:00',
      arrivalTime: '20:00',
      endsNextDay: true,
    });

    expect(result.success).toBe(true);
  });

  it('defaults endsNextDay to false, which is what makes the rule bite', () => {
    const result = createServiceSchema.safeParse(validService);

    expect(result.data?.endsNextDay).toBe(false);
  });

  it('rejects a malformed time', () => {
    const result = createServiceSchema.safeParse({ ...validService, departureTime: '7:45' });

    expect(result.success).toBe(false);
    expect(errorPaths(result)).toContain('departureTime');
  });
});

describe('createServiceSchema — mass assignment (SRS 22.4, 9.6)', () => {
  // Each of these is a server-owned field. SRS 22.4 forbids a browser value
  // overriding any of them; declaring the schema strict turns "ignored" into
  // "rejected", which is what makes the rule testable.
  const forbidden = {
    // SRS 9.5 is absolute for drivers even though an administrator may now
    // file on a driver's behalf: the driver's schema has no such field, so a
    // driver cannot reach it by any path (client decision #7).
    driverId: '0199a1b2-c3d4-7000-8000-0000000000ff',
    status: 'APPROVED',
    actualKm: 99_999,
    serviceKm: 99_999,
    serviceCode: 'SRV-20260902-000001',
    serviceDate: '2020-01-01',
    approvedAt: '2026-09-02T00:00:00.000Z',
    approvedByUserId: '0199a1b2-c3d4-7000-8000-0000000000fe',
    originSnapshot: 'Anywhere',
    destinationSnapshot: 'Anywhere',
    createdAt: '2020-01-01T00:00:00.000Z',
  };

  for (const [field, value] of Object.entries(forbidden)) {
    it(`rejects a payload carrying ${field}`, () => {
      const result = createServiceSchema.safeParse({ ...validService, [field]: value });

      expect(result.success).toBe(false);
    });
  }

  it('accepts driverId on the administrator schema only', () => {
    const driverId = '0199a1b2-c3d4-7000-8000-0000000000ff';

    expect(createServiceSchema.safeParse({ ...validService, driverId }).success).toBe(false);
    expect(adminCreateServiceSchema.safeParse({ ...validService, driverId }).success).toBe(
      true,
    );
  });

  it('requires the administrator to say whose service it is', () => {
    // Defaulting to the acting administrator would silently create a service
    // owned by someone who does not drive.
    const result = adminCreateServiceSchema.safeParse(validService);

    expect(result.success).toBe(false);
    expect(errorPaths(result)).toContain('driverId');
  });

  it('still rejects server-owned fields on the administrator schema', () => {
    const result = adminCreateServiceSchema.safeParse({
      ...validService,
      driverId: '0199a1b2-c3d4-7000-8000-0000000000ff',
      status: 'APPROVED',
    });

    expect(result.success).toBe(false);
  });

  it('rejects the approve endpoint being handed approval metadata', () => {
    expect(approveServiceSchema.safeParse({}).success).toBe(true);
    expect(
      approveServiceSchema.safeParse({
        approvedByUserId: '0199a1b2-c3d4-7000-8000-0000000000fe',
      }).success,
    ).toBe(false);
  });
});

describe('serviceFilterSchema (SRS 16.3)', () => {
  it('applies sensible pagination defaults', () => {
    const result = serviceFilterSchema.safeParse({});

    expect(result.data?.page).toBe(1);
    expect(result.data?.pageSize).toBe(25);
  });

  it('caps pageSize so a crafted request cannot pull the whole table', () => {
    expect(serviceFilterSchema.safeParse({ pageSize: '100000' }).success).toBe(false);
  });

  it('normalises a single status into an array', () => {
    expect(serviceFilterSchema.safeParse({ status: 'APPROVED' }).data?.status).toEqual([
      'APPROVED',
    ]);
  });

  it('accepts a repeated status parameter', () => {
    expect(
      serviceFilterSchema.safeParse({ status: ['APPROVED', 'PENDING_APPROVAL'] }).data?.status,
    ).toEqual(['APPROVED', 'PENDING_APPROVAL']);
  });

  it('rejects an inverted date range', () => {
    const result = serviceFilterSchema.safeParse({
      dateFrom: '2026-09-30',
      dateTo: '2026-09-01',
    });

    expect(result.success).toBe(false);
    expect(errorPaths(result)).toContain('dateTo');
  });

  it('ignores unrelated query parameters', () => {
    // Not strict: a stray tracking parameter cannot escalate a permission, and
    // rejecting it would be hostile.
    expect(serviceFilterSchema.safeParse({ ref: 'newsletter' }).success).toBe(true);
  });
});

describe('user schemas (SRS 12, 22.1)', () => {
  it('lower-cases the login identifier so case cannot fork an account', () => {
    expect(loginIdentifierSchema.safeParse('  Driver1  ').data).toBe('driver1');
  });

  it('rejects a login identifier with unsupported characters', () => {
    expect(loginIdentifierSchema.safeParse('driver 1').success).toBe(false);
    expect(loginIdentifierSchema.safeParse('driver@bribar').success).toBe(false);
  });

  it('enforces the minimum password length', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('a-perfectly-fine-passphrase').success).toBe(true);
  });

  it('rejects an obviously guessable password', () => {
    expect(passwordSchema.safeParse('password123').success).toBe(false);
  });

  it('rejects a password containing the login identifier', () => {
    const result = createUserSchema.safeParse({
      name: 'Ana Ferreira',
      loginIdentifier: 'driver1',
      password: 'driver1-driver1-driver1',
      role: 'DRIVER',
    });

    expect(result.success).toBe(false);
    expect(errorPaths(result)).toContain('password');
  });

  it('does not let an administrator be given a default vehicle (SRS 3.2)', () => {
    const result = createUserSchema.safeParse({
      name: 'Administrator',
      loginIdentifier: 'admin',
      password: 'a-perfectly-fine-passphrase',
      role: 'ADMIN',
      defaultVehicleId: VEHICLE_ID,
    });

    expect(result.success).toBe(false);
    expect(errorPaths(result)).toContain('defaultVehicleId');
  });

  it('does not let an administrator be assigned routes (SRS 19.6)', () => {
    const result = createUserSchema.safeParse({
      name: 'Administrator',
      loginIdentifier: 'admin',
      password: 'a-perfectly-fine-passphrase',
      role: 'ADMIN',
      assignments: [{ routeId: ROUTE_ID }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a payload carrying passwordHash or role escalation via extra keys', () => {
    const result = createUserSchema.safeParse({
      name: 'Ana Ferreira',
      loginIdentifier: 'driver1',
      password: 'a-perfectly-fine-passphrase',
      role: 'DRIVER',
      passwordHash: '$argon2id$...',
    });

    expect(result.success).toBe(false);
  });
});

describe('route assignments (SRS 12.6)', () => {
  it('accepts many routes with one default', () => {
    const result = replaceRouteAssignmentsSchema.safeParse({
      assignments: [
        { routeId: ROUTE_ID, isDefault: true },
        { routeId: OTHER_ROUTE_ID, isDefault: false },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('accepts a set with no default yet (SRS 9.2 handles that at Add Service)', () => {
    expect(
      replaceRouteAssignmentsSchema.safeParse({ assignments: [{ routeId: ROUTE_ID }] }).success,
    ).toBe(true);
  });

  it('rejects two defaults', () => {
    const result = replaceRouteAssignmentsSchema.safeParse({
      assignments: [
        { routeId: ROUTE_ID, isDefault: true },
        { routeId: OTHER_ROUTE_ID, isDefault: true },
      ],
    });

    expect(result.success).toBe(false);
    expect(errorPaths(result)).toContain('assignments');
  });

  it('rejects the same route listed twice', () => {
    const result = replaceRouteAssignmentsSchema.safeParse({
      assignments: [{ routeId: ROUTE_ID }, { routeId: ROUTE_ID }],
    });

    expect(result.success).toBe(false);
    expect(errorPaths(result)).toContain('assignments.1.routeId');
  });
});

describe('master-data schemas (SRS 13, 14)', () => {
  it('normalises a registration plate', () => {
    const result = createVehicleSchema.safeParse({ registrationPlate: ' 12-ab  34 ' });

    expect(result.data?.registrationPlate).toBe('12-AB 34');
  });

  it('defaults a new vehicle to active', () => {
    expect(
      createVehicleSchema.safeParse({ registrationPlate: 'AA-01-BB' }).data?.isActive,
    ).toBe(true);
  });

  it('upper-cases a route code so casing cannot fork a route', () => {
    const result = createRouteSchema.safeParse({
      code: ' lis-prt-01 ',
      name: 'Lisboa - Porto',
      origin: 'Lisboa DC',
      destination: 'Porto Terminal',
    });

    expect(result.data?.code).toBe('LIS-PRT-01');
  });

  it('requires an origin and a destination (SRS 14.1)', () => {
    const result = createRouteSchema.safeParse({
      code: 'LIS-PRT-01',
      name: 'Lisboa - Porto',
      origin: '   ',
    });

    expect(result.success).toBe(false);
    expect(errorPaths(result)).toEqual(expect.arrayContaining(['origin', 'destination']));
  });
});
