/**
 * Vehicle master-data schemas (SRS 13, 19.4).
 */
import { z } from 'zod';

import { booleanSchema, optionalText } from '@/modules/shared/schemas/common';

export const REGISTRATION_PLATE_MAX_LENGTH = 32;
export const REFERENCE_NAME_MAX_LENGTH = 120;

/**
 * Registration plates are stored upper-cased with internal whitespace
 * collapsed, so `"12-ab-34"` and `"12 AB 34"` cannot both be entered as
 * separate vehicles and defeat the unique constraint.
 *
 * The character set stays deliberately loose - letters, digits, spaces and
 * hyphens - because plate formats differ by country and BRIBAR may operate
 * across borders. The unique constraint, not a format rule, is what protects
 * data integrity here.
 */
export const registrationPlateSchema = z.preprocess(
  (value) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toUpperCase() : value,
  z
    .string({ error: 'Registration plate is required.' })
    .min(2, 'Registration plate must be at least 2 characters.')
    .max(
      REGISTRATION_PLATE_MAX_LENGTH,
      `Registration plate must be ${REGISTRATION_PLATE_MAX_LENGTH} characters or fewer.`,
    )
    .regex(
      /^[A-Z0-9][A-Z0-9 -]*$/,
      'Registration plate may contain only letters, numbers, spaces and hyphens.',
    ),
);

export const createVehicleSchema = z.strictObject({
  registrationPlate: registrationPlateSchema,
  referenceName: optionalText('Vehicle name', REFERENCE_NAME_MAX_LENGTH),
  /** SRS 13.3. New vehicles are selectable immediately unless told otherwise. */
  isActive: booleanSchema.default(true),
});

export type CreateVehicleInput = z.output<typeof createVehicleSchema>;

/**
 * SRS 13.4. Deactivation is the only removal path - a vehicle referenced by a
 * historical service is never deleted (SRS 21.5), and the `onDelete: Restrict`
 * foreign keys enforce that even if a future endpoint tries.
 */
export const updateVehicleSchema = createVehicleSchema.partial();

export type UpdateVehicleInput = z.output<typeof updateVehicleSchema>;
