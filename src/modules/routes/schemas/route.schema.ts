/**
 * Route/Contract master-data schemas (SRS 14, 19.5).
 *
 * Named `Route` internally and labelled "Route/Contract" in the interface,
 * exactly as SRS 6.2 permits.
 */
import { z } from 'zod';

import { FIELD_LABELS, VALIDATION } from '@/lib/i18n/messages';
import {
  booleanSchema,
  clearableUuidSchema,
  moneySchema,
  requiredText,
} from '@/modules/shared/schemas/common';

export const ROUTE_CODE_MAX_LENGTH = 32;
export const ROUTE_NAME_MAX_LENGTH = 160;
export const LOCATION_MAX_LENGTH = 160;

/**
 * Route codes are normalised to upper case for the same reason as vehicle
 * plates: `lis-01` and `LIS-01` must not be two routes.
 */
export const routeCodeSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
  z
    .string({ error: VALIDATION.required(FIELD_LABELS.routeCode) })
    .min(2, VALIDATION.tooShort(FIELD_LABELS.routeCode, 2))
    .max(
      ROUTE_CODE_MAX_LENGTH,
      VALIDATION.tooLong(FIELD_LABELS.routeCode, ROUTE_CODE_MAX_LENGTH),
    )
    .regex(/^[A-Z0-9][A-Z0-9._-]*$/, VALIDATION.routeCodeFormat),
);

/**
 * SRS 6.5 explicitly declines a Site master-data module for V1, so origin and
 * destination are free text rather than references. They are snapshotted onto
 * each service (14.5), which is what makes editing them here safe.
 */
export const createRouteSchema = z.strictObject({
  code: routeCodeSchema,
  name: requiredText(FIELD_LABELS.routeName, ROUTE_NAME_MAX_LENGTH, 2),
  origin: requiredText(FIELD_LABELS.origin, LOCATION_MAX_LENGTH),
  destination: requiredText(FIELD_LABELS.destination, LOCATION_MAX_LENGTH),
  isActive: booleanSchema.default(true),
  /**
   * Admin-only (ERP roadmap Phase 0, client change request 2026-09-09). Never
   * exposed to a driver — the route pickers a driver sees come from
   * `userRepository.listAssignableRoutes`, which does not select this column.
   */
  defaultRate: moneySchema,
  /**
   * ERP roadmap Phase 4 (roadmap §6 B4, "Contrato = Route"). Admin-only,
   * same visibility as `defaultRate`. `clearableUuidSchema`, not
   * `optionalUuidSchema` — a contract ending must be able to unset the
   * client, not just leave it unmentioned.
   */
  clientId: clearableUuidSchema,
  /**
   * "Cliente final" (client change request 2026-09-17) — assignable in the
   * same place as `clientId`, for the same reason: an administrator sets it
   * when editing a route's origin/destination, not per-service.
   */
  endClientId: clearableUuidSchema,
});

export type CreateRouteInput = z.output<typeof createRouteSchema>;

/**
 * SRS 14.2 and 21.4: an administrator may change origin and destination at any
 * time, and doing so must affect only *future* services. Nothing in this
 * schema needs to guard that - the snapshot columns on `services` do - but it
 * is the reason those columns exist.
 */
export const updateRouteSchema = createRouteSchema.partial();

export type UpdateRouteInput = z.output<typeof updateRouteSchema>;
