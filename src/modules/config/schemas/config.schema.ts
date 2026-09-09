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
import { EUROS_PATTERN, eurosToCents } from '@/lib/money/money';
import { LITERS_PATTERN, litersToMilliliters } from '@/lib/units/fuel';

/** A positive whole number of kilometres (the oil-change interval). */
const wholeKmSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}, z.string({ error: VALIDATION.invalidWholeKm }).regex(/^\d+$/, VALIDATION.invalidWholeKm).transform(Number).pipe(z.number().int().min(1, VALIDATION.invalidWholeKm)));

/** A litre amount with up to one decimal (default fuel consumption). */
const litersSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}, z.string({ error: VALIDATION.invalidLiters }).regex(LITERS_PATTERN, VALIDATION.invalidLiters).transform(litersToMilliliters));

/** A required euro amount (default fuel price) — never null, unlike `moneySchema`. */
const requiredEurosSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}, z.string({ error: VALIDATION.invalidMoney }).regex(EUROS_PATTERN, VALIDATION.invalidMoney).transform(eurosToCents));

export const updateConfigSchema = z.strictObject({
  oilChangeIntervalKm: wholeKmSchema,
  defaultConsumption: litersSchema,
  defaultFuelPrice: requiredEurosSchema,
});

export type UpdateConfigInput = z.output<typeof updateConfigSchema>;
