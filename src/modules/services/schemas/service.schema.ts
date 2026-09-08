/**
 * Request schemas for the service workflow (SRS 9, 10, 16.3, 22.4).
 *
 * The most important property of this file is what it *omits*.
 *
 * SRS 22.4 requires that "browser-supplied driver_id, approval user,
 * timestamps, calculations, or status shall not override server-owned values",
 * and SRS 9.6 that "the server shall generate or verify all system-owned
 * fields, rather than trusting equivalent values supplied by the browser".
 * Every schema below is a `strictObject`, so those fields are not merely
 * stripped — a request carrying `status`, `actualKm`, `serviceCode` or
 * `approvedAt` is rejected with a 400 naming the offending key.
 *
 * Stripping would also be safe, but silence is a poor way to learn that a
 * client is trying something it should not. Rejecting turns SRS 26.8's security
 * tests — "role escalation through modified requests fails", "driver ID
 * substitution fails" — into assertions with a visible result.
 */
import { z } from 'zod';

import {
  FIELD_LABELS,
  MILEAGE_VIOLATION_MESSAGES,
  SERVICE_TIME_VIOLATION_MESSAGES,
  VALIDATION,
} from '@/lib/i18n/messages';
import {
  isoDateSchema,
  odometerKmSchema,
  optionalText,
  paginationSchema,
  timeOfDaySchema,
  uuidSchema,
} from '@/modules/shared/schemas/common';
import { validateMileage, type OdometerReadings } from '../domain/mileage';
import { validateServiceTimes, type ServiceTimes } from '../domain/service-times';
import { ServiceStatus } from '../domain/service-status';

/**
 * The fields a service body carries, before any cross-field rule.
 *
 * Held as a plain shape rather than a schema because `superRefine` produces a
 * type that cannot be extended, and the administrator variant below needs to
 * add `driverId` before refining.
 */
const serviceBodyShape = {
  vehicleId: uuidSchema,
  routeId: uuidSchema,

  startDashboardKm: odometerKmSchema,
  startBaseKm: odometerKmSchema,
  endBaseKm: odometerKmSchema,
  endDashboardKm: odometerKmSchema,

  departureTime: timeOfDaySchema,
  arrivalTime: timeOfDaySchema,

  /**
   * SRS 31.3 + client decision #3. Defaults to false, which is what makes the
   * same-day ordering rule apply to a driver who simply does not tick the box.
   * When true, the arrival time is accepted as entered (change request
   * 2026-09-09) — see `domain/service-times.ts`.
   */
  endsNextDay: z.boolean().default(false),

  sites: optionalText(FIELD_LABELS.sites),
  observations: optionalText(FIELD_LABELS.observations),
} as const;

/**
 * Applies both cross-field rule sets, delegating to the domain layer rather
 * than restating SRS 10.3 in Zod refinements.
 *
 * The domain modules return codes and field names; the Spanish wording is
 * looked up here. That division is what lets `domain/` stay dependency-free.
 */
function refineServiceBody(value: OdometerReadings & ServiceTimes, ctx: z.RefinementCtx): void {
  for (const violation of validateMileage(value)) {
    const label =
      violation.field === 'root'
        ? ''
        : (FIELD_LABELS[violation.field as keyof typeof FIELD_LABELS] ?? '');

    ctx.addIssue({
      code: 'custom',
      path: violation.field === 'root' ? [] : [violation.field],
      message: MILEAGE_VIOLATION_MESSAGES[violation.code]?.(label) ?? '',
    });
  }

  for (const violation of validateServiceTimes(value)) {
    ctx.addIssue({
      code: 'custom',
      path: [violation.field],
      message: SERVICE_TIME_VIOLATION_MESSAGES[violation.code] ?? '',
    });
  }
}

/**
 * The Add Service payload as a **driver** submits it (SRS 9.3, 9.4).
 *
 * Present: the vehicle and route the driver chose, the six mandatory inputs,
 * the overnight flag, and the two optional fields.
 *
 * Absent by design: `driverId` comes from the session — SRS 9.5, "the Driver
 * field shall always reflect the authenticated user", is absolute for drivers
 * and a submitted `driverId` is rejected outright. `serviceDate`,
 * `serviceCode`, `status` and both timestamps are server-generated (SRS 9.2);
 * `origin` and `destination` are snapshotted from the route server-side
 * (SRS 14.4); `actualKm` and `serviceKm` are recalculated on every write
 * (SRS 10.2).
 *
 * Whether the chosen route is actually assigned to this driver and still active
 * needs the database, so it belongs to the service layer (SRS 14.3, 26.2).
 */
export const createServiceSchema = z
  .strictObject(serviceBodyShape)
  .superRefine(refineServiceBody);

export type CreateServiceInput = z.output<typeof createServiceSchema>;

/**
 * The same payload as an **administrator** submits it, on a driver's behalf
 * (SRS 17.2, client decision #7).
 *
 * `driverId` is required rather than optional. An administrator filing a
 * service must say whose it is; defaulting to the administrator's own id would
 * silently create a service owned by someone who does not drive, and the
 * `driver_routes` model has no rows for an administrator anyway.
 *
 * The route handler chooses which of the two schemas to apply from the
 * session's role. A driver's request is never parsed with this one, so a driver
 * cannot reach the `driverId` field by any path.
 */
export const adminCreateServiceSchema = z
  .strictObject({
    ...serviceBodyShape,
    driverId: uuidSchema.describe(VALIDATION.driverRequired),
  })
  .superRefine(refineServiceBody);

export type AdminCreateServiceInput = z.output<typeof adminCreateServiceSchema>;

/**
 * Editing an existing service (SRS 10.4, 11.2, 21.3).
 *
 * A full replacement rather than a partial patch, even though the route is
 * `PATCH`. Mileage and time validation are inherently cross-field: accepting
 * one reading alone would mean re-reading the other three from the database to
 * check the sequence, and the value read might already be stale. Sending the
 * whole set keeps the rules checkable from the request alone.
 *
 * `driverId` is not editable by anyone. Reassigning a service to a different
 * driver would rewrite ownership of an audited record; if that is ever needed,
 * it should be its own endpoint with its own audit action.
 *
 * Who may send this, and in what state, is settled by `canEdit` before the body
 * is parsed.
 */
export const updateServiceSchema = createServiceSchema;

export type UpdateServiceInput = z.output<typeof updateServiceSchema>;

/**
 * Admin services filters (SRS 16.3).
 *
 * `status` accepts a repeated query parameter so the approval queue and a
 * combined view share one endpoint. Not strict: query strings routinely carry
 * unrelated keys, and rejecting a stray `?ref=` would be hostile without buying
 * any safety, since a filter cannot escalate a permission.
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
        message: VALIDATION.dateRangeInverted,
      });
    }
  });

export type ServiceFilterInput = z.output<typeof serviceFilterSchema>;

/**
 * The approve request (SRS 11.3).
 *
 * Empty on purpose. The target comes from the URL, the approving administrator
 * from the session, and the timestamp from the server; there is nothing a
 * client could legitimately contribute. Declaring it as an empty strict object
 * means a body attempting to set `approvedByUserId` is rejected rather than
 * ignored.
 */
export const approveServiceSchema = z.strictObject({});
