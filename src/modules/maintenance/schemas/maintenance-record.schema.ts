/**
 * Maintenance-record schemas (ERP roadmap Phase 5, `05Mantenimiento`).
 *
 * Admin-only, same reasoning as `refuelling.schema.ts`. `maintenanceCode` and
 * `performedDate`/`vehicleId`/`maintenanceTypeId` are the historical record;
 * `nextDueKm`/`nextDueDate` are the administrator's own forward estimate,
 * both optional because either signal (or neither, yet) may be known - see
 * `domain/maintenance-urgency.ts` for how they are read back. Cost is
 * deliberately absent: that is `ReceivedInvoice`'s job (Phase 3), not this
 * module's - see ADR 0016.
 */
import { z } from 'zod';

import { FIELD_LABELS } from '@/lib/i18n/messages';
import {
  isoDateSchema,
  odometerKmSchema,
  optionalText,
  uuidSchema,
} from '@/modules/shared/schemas/common';

/** `nextDueKm` reuses `odometerKmSchema`'s shape - it is an odometer reading. */
const optionalOdometerKmSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : value;
}, odometerKmSchema.optional());

const optionalIsoDateSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : value;
}, isoDateSchema.optional());

export const createMaintenanceRecordSchema = z.strictObject({
  vehicleId: uuidSchema,
  maintenanceTypeId: uuidSchema,
  performedDate: isoDateSchema,
  performedKm: optionalOdometerKmSchema,
  nextDueKm: optionalOdometerKmSchema,
  nextDueDate: optionalIsoDateSchema,
  notes: optionalText(FIELD_LABELS.observations),
});

export type CreateMaintenanceRecordInput = z.output<typeof createMaintenanceRecordSchema>;

export const updateMaintenanceRecordSchema = createMaintenanceRecordSchema.partial();

export type UpdateMaintenanceRecordInput = z.output<typeof updateMaintenanceRecordSchema>;
