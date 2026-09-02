/**
 * Route/Contract master-data schemas (SRS 14, 19.5).
 *
 * Named `Route` internally and labelled "Route/Contract" in the interface,
 * exactly as SRS 6.2 permits.
 */
import { z } from 'zod';

import { booleanSchema, requiredText } from '@/modules/shared/schemas/common';

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
    .string({ error: 'Route code is required.' })
    .min(2, 'Route code must be at least 2 characters.')
    .max(
      ROUTE_CODE_MAX_LENGTH,
      `Route code must be ${ROUTE_CODE_MAX_LENGTH} characters or fewer.`,
    )
    .regex(
      /^[A-Z0-9][A-Z0-9._-]*$/,
      'Route code may contain only letters, numbers, dots, hyphens and underscores.',
    ),
);

/**
 * SRS 6.5 explicitly declines a Site master-data module for V1, so origin and
 * destination are free text rather than references. They are snapshotted onto
 * each service (14.5), which is what makes editing them here safe.
 */
export const createRouteSchema = z.strictObject({
  code: routeCodeSchema,
  name: requiredText('Route/Contract name', ROUTE_NAME_MAX_LENGTH, 2),
  origin: requiredText('Origin', LOCATION_MAX_LENGTH),
  destination: requiredText('Destination', LOCATION_MAX_LENGTH),
  isActive: booleanSchema.default(true),
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
