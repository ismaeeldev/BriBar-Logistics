/**
 * Expense category schemas (ERP roadmap Phase 3, deferred from Phase 1 —
 * ADR 0012).
 */
import { z } from 'zod';

import { FIELD_LABELS } from '@/lib/i18n/messages';
import { booleanSchema, requiredText, vatRateSchema } from '@/modules/shared/schemas/common';

export const EXPENSE_CATEGORY_NAME_MAX_LENGTH = 160;

export const EXPENSE_TYPES = ['OPERATION', 'INVESTMENT', 'NON_OPERATING'] as const;

export const expenseTypeSchema = z.enum(EXPENSE_TYPES, { error: FIELD_LABELS.expenseType });

export const createExpenseCategorySchema = z.strictObject({
  name: requiredText(FIELD_LABELS.name, EXPENSE_CATEGORY_NAME_MAX_LENGTH),
  expenseType: expenseTypeSchema,
  defaultVatRate: vatRateSchema.default('STANDARD'),
  isActive: booleanSchema.default(true),
});

export type CreateExpenseCategoryInput = z.output<typeof createExpenseCategorySchema>;

export const updateExpenseCategorySchema = createExpenseCategorySchema.partial();

export type UpdateExpenseCategoryInput = z.output<typeof updateExpenseCategorySchema>;
