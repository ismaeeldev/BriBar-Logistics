/**
 * Personnel-cost schemas (ERP roadmap Phase 5, `04_Personal`).
 *
 * Admin-only, same reasoning as every other admin-only module built this
 * session. `totalCents` has no field here at all — it is always
 * `base + overtime + allowances + other`, computed server-side
 * (`personnelCostService`), never a client input (CLAUDE.md's "never trust
 * the client for a calculated value").
 */
import { z } from 'zod';

import { FIELD_LABELS, VALIDATION } from '@/lib/i18n/messages';
import {
  moneySchema,
  optionalText,
  requiredMoneySchema,
  uuidSchema,
} from '@/modules/shared/schemas/common';

const yearSchema = z
  .string({ error: VALIDATION.required(FIELD_LABELS.year) })
  .regex(/^\d{4}$/, VALIDATION.invalidYear)
  .transform(Number);

const monthSchema = z
  .string({ error: VALIDATION.required(FIELD_LABELS.month) })
  .regex(/^\d{1,2}$/, VALIDATION.invalidMonth)
  .transform(Number)
  .pipe(z.number().int().min(1, VALIDATION.invalidMonth).max(12, VALIDATION.invalidMonth));

export const createPersonnelCostSchema = z.strictObject({
  userId: uuidSchema,
  year: yearSchema,
  month: monthSchema,
  base: requiredMoneySchema,
  /**
   * `moneySchema`'s three-way signal (absent/clear/value), not
   * `requiredMoneySchema` — overtime, allowances and "other" are all
   * genuinely optional per row, unlike the base amount.
   */
  overtime: moneySchema,
  allowances: moneySchema,
  other: moneySchema,
  notes: optionalText(FIELD_LABELS.observations),
});

export type CreatePersonnelCostInput = z.output<typeof createPersonnelCostSchema>;

export const updatePersonnelCostSchema = createPersonnelCostSchema.partial();

export type UpdatePersonnelCostInput = z.output<typeof updatePersonnelCostSchema>;
