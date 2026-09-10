/**
 * Supplier master-data schemas (ERP roadmap Phase 3, deferred from Phase 1 —
 * ADR 0012).
 *
 * Same shape as `client.schema.ts` — see that file's doc comment for why.
 */
import { z } from 'zod';

import { FIELD_LABELS } from '@/lib/i18n/messages';
import { booleanSchema, optionalText, requiredText } from '@/modules/shared/schemas/common';

export const SUPPLIER_NAME_MAX_LENGTH = 160;
export const TAX_ID_MAX_LENGTH = 32;

export const createSupplierSchema = z.strictObject({
  name: requiredText(FIELD_LABELS.name, SUPPLIER_NAME_MAX_LENGTH),
  taxId: optionalText(FIELD_LABELS.taxId, TAX_ID_MAX_LENGTH),
  isActive: booleanSchema.default(true),
});

export type CreateSupplierInput = z.output<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial();

export type UpdateSupplierInput = z.output<typeof updateSupplierSchema>;
