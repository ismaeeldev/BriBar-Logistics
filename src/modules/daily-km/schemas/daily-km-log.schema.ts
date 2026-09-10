/**
 * Daily-km-log schemas (ERP roadmap Phase 5, `00KmDiariosReales`).
 *
 * Admin-only for this pass, same reasoning as `refuelling.schema.ts` — see
 * the doc comment on `DailyKmLog` in `schema.prisma`. `date` is
 * administrator-supplied like `ReceivedInvoice.invoiceDate`: a daily log is
 * typically entered in a batch some days after the fact, from paper
 * records, not necessarily "today".
 */
import { z } from 'zod';

import { FIELD_LABELS, VALIDATION } from '@/lib/i18n/messages';
import {
  isoDateSchema,
  odometerKmSchema,
  optionalText,
  optionalUuidSchema,
  uuidSchema,
} from '@/modules/shared/schemas/common';

/** Whole minutes, from up to one decimal hour of input ("8,5" -> 510). */
const WORKED_HOURS_PATTERN = /^\d+([.,]\d)?$/;

const workedMinutesSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  },
  // `.optional()` sits inside the preprocess, not outside it: a blank string
  // becomes `undefined` here, and the outer form (`text(formData, …)` returns
  // `""`) must be able to submit that as "no hours entered".
  z
    .string()
    .regex(WORKED_HOURS_PATTERN, VALIDATION.invalidWorkedHours)
    .transform((value) => Math.round(Number(value.replace(',', '.')) * 60))
    .optional(),
);

export const createDailyKmLogSchema = z.strictObject({
  vehicleId: uuidSchema,
  routeId: optionalUuidSchema,
  driverId: optionalUuidSchema,
  date: isoDateSchema,
  actualKm: odometerKmSchema,
  workedHours: workedMinutesSchema,
  notes: optionalText(FIELD_LABELS.observations),
});

export type CreateDailyKmLogInput = z.output<typeof createDailyKmLogSchema>;

export const updateDailyKmLogSchema = createDailyKmLogSchema.partial();

export type UpdateDailyKmLogInput = z.output<typeof updateDailyKmLogSchema>;
