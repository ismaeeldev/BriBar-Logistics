/**
 * The operational-defaults form (`99_Config`, ERP roadmap Phase 1).
 *
 * Unlike `moneySchema` (`modules/shared/schemas/common.ts`), every field here
 * is required and never nullable: `app_config` is a single row that always
 * exists (seeded by the migration) and always has a value in each column —
 * there is no "clear the default" state to represent, only "change it".
 */
import { z } from 'zod';

import { VALIDATION } from '@/lib/i18n/messages';
import { litersSchema, requiredMoneySchema } from '@/modules/shared/schemas/common';

/** A positive whole number of kilometres (the oil-change interval). */
const wholeKmSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}, z.string({ error: VALIDATION.invalidWholeKm }).regex(/^\d+$/, VALIDATION.invalidWholeKm).transform(Number).pipe(z.number().int().min(1, VALIDATION.invalidWholeKm)));

export const updateConfigSchema = z.strictObject({
  oilChangeIntervalKm: wholeKmSchema,
  defaultConsumption: litersSchema,
  defaultFuelPrice: requiredMoneySchema,
});

export type UpdateConfigInput = z.output<typeof updateConfigSchema>;
