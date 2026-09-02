/**
 * Request schemas for the service workflow (SRS 9, 10, 16.3, 22.4).
 *
 * The most important property of this file is what it *omits*.
 *
 * SRS 22.4 requires that "browser-supplied driver_id, approval user,
 * timestamps, calculations, or status shall not override server-owned values",
 * and 9.6 that "the server shall generate or verify all system-owned fields,
 * rather than trusting equivalent values supplied by the browser". Every
 * schema below is a `strictObject`, so those fields are not merely stripped -
 * a request carrying `driverId`, `status`, `actualKm`, `serviceCode` or
 * `approvedAt` is rejected with a 400 naming the offending key.
 *
 * Stripping would also be safe, but silence is a poor way to learn that a
 * client is trying something it should not. Rejecting turns SRS 26.8's
 * security tests - "role escalation through modified requests fails", "driver
 * ID substitution fails" - into assertions with a visible result.
 */
import { z } from 'zod';

import {
  isoDateSchema,
  odometerKmSchema,
  optionalText,
  paginationSchema,
  timeOfDaySchema,
  uuidSchema,
} from '@/modules/shared/schemas/common';
import { validateMileage, type OdometerReadings } from '../domain/mileage';
import { ServiceStatus } from '../domain/service-status';

/** Longest accepted values for the two optional free-text fields (SRS 9.4). */
export const SITES_MAX_LENGTH = 500;
export const OBSERVATIONS_MAX_LENGTH = 2000;

/**
 * The four odometer readings, checked individually and then as a sequence.
 *
 * The cross-field pass delegates to `validateMileage` rather than restating
 * SRS 10.3 in Zod. The domain module is the single definition of the rule; the
 * schema only decides which field each violation is reported against.
 */
export const mileageSchema = z
  .object({
    startDashboardKm: odometerKmSchema,
    startBaseKm: odometerKmSchema,
    endBaseKm: odometerKmSchema,
    endDashboardKm: odometerKmSchema,
  })
  .superRefine((readings, ctx) => {
    for (const violation of validateMileage(readings as OdometerReadings)) {
      ctx.addIssue({
        code: 'custom',
        path: violation.field === 'root' ? [] : [violation.field],
        message: violation.message,
      });
    }
  });

/**
 * The complete Add Service payload (SRS 9.3, 9.4).
 *
 * Present: the vehicle and route the driver chose, the six mandatory inputs,
 * and the two optional ones.
 *
 * Absent by design: `driverId` comes from the session (SRS 9.5 - "the Driver
 * field shall always reflect the authenticated user"); `serviceDate`,
 * `serviceCode`, `status` and both timestamps are server-generated (9.2);
 * `origin` and `destination` are snapshotted from the route server-side
 * (14.4 - "Driver cannot manually override these fields"); `actualKm` and
 * `serviceKm` are recalculated on every write (10.2).
 *
 * Whether the chosen route is actually assigned to this driver and still
 * active is an authorisation question that needs the database, so it belongs
 * to the service layer, not here (SRS 14.3, 26.2).
 */
export const createServiceSchema = z
  .strictObject({
    vehicleId: uuidSchema,
    routeId: uuidSchema,

    startDashboardKm: odometerKmSchema,
    startBaseKm: odometerKmSchema,
    endBaseKm: odometerKmSchema,
    endDashboardKm: odometerKmSchema,

    departureTime: timeOfDaySchema,
    arrivalTime: timeOfDaySchema,

    sites: optionalText('Sites', SITES_MAX_LENGTH),
    observations: optionalText('Observations', OBSERVATIONS_MAX_LENGTH),
  })
  .superRefine((value, ctx) => {
    for (const violation of validateMileage(value as OdometerReadings)) {
      ctx.addIssue({
        code: 'custom',
        path: violation.field === 'root' ? [] : [violation.field],
        message: violation.message,
      });
    }
  });

export type CreateServiceInput = z.output<typeof createServiceSchema>;

/**
 * Editing an existing service (SRS 10.4, 11.2, 21.3).
 *
 * A full replacement rather than a partial patch, even though the route is
 * `PATCH`. Mileage validation is inherently cross-field: accepting one reading
 * on its own would mean re-reading the other three from the database to check
 * the sequence, and the value read might already be stale. Sending all six
 * fields keeps the rule checkable from the request alone.
 *
 * Who may send this, and in what state, is settled by `canEdit` before the
 * body is ever parsed.
 */
export const updateServiceSchema = createServiceSchema;

export type UpdateServiceInput = z.output<typeof updateServiceSchema>;

/**
 * Admin services filters (SRS 16.3).
 *
 * `status` accepts a repeated query parameter so the approval queue and a
 * combined view use the same endpoint. Not strict: query strings routinely
 * carry unrelated keys, and rejecting a stray `?ref=` would be hostile without
 * buying any safety, since a filter cannot escalate a permission.
 */
export const serviceFilterSchema = paginationSchema
  .extend({
    dateFrom: isoDateSchema.optional(),
    dateTo: isoDateSchema.optional(),
    driverId: uuidSchema.optional(),
    vehicleId: uuidSchema.optional(),
    routeId: uuidSchema.optional(),
    status: z
      .union([z.enum(ServiceStatus), z.array(z.enum(ServiceStatus))])
      .transform((value) => (Array.isArray(value) ? value : [value]))
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      ctx.addIssue({
        code: 'custom',
        path: ['dateTo'],
        message: 'The end date cannot be before the start date.',
      });
    }
  });

export type ServiceFilterInput = z.output<typeof serviceFilterSchema>;

/**
 * The approve request (SRS 11.3).
 *
 * Empty on purpose. The target comes from the URL, the approving
 * administrator from the session, and the timestamp from the server; there is
 * nothing a client could legitimately contribute. Declaring it as an empty
 * strict object means a body attempting to set `approvedByUserId` is rejected
 * rather than ignored.
 */
export const approveServiceSchema = z.strictObject({});
