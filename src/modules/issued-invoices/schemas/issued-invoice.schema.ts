/**
 * Issued-invoice schemas (ERP roadmap Phase 4, `05Facturas_Emitidas`).
 *
 * Admin-only, same reasoning as `received-invoice.schema.ts`. No general
 * "edit everything" schema, unlike every other module this session built —
 * see the doc comment on `issuedInvoiceService.update` for why an issued
 * invoice's client, date, rate and service list are fixed once created.
 */
import { z } from 'zod';

import { FIELD_LABELS, VALIDATION } from '@/lib/i18n/messages';
import {
  isoDateSchema,
  optionalText,
  optionalUuidSchema,
  uuidSchema,
  vatRateSchema,
} from '@/modules/shared/schemas/common';

export const createIssuedInvoiceSchema = z.strictObject({
  clientId: uuidSchema,
  invoiceDate: isoDateSchema,
  vatRate: vatRateSchema,
  /** At least one service - an invoice with nothing billed on it is not an
   * invoice. */
  serviceIds: z.array(uuidSchema).min(1, VALIDATION.selectAtLeastOneService),
  stateId: optionalUuidSchema,
  notes: optionalText(FIELD_LABELS.observations),
});

export type CreateIssuedInvoiceInput = z.output<typeof createIssuedInvoiceSchema>;

/** Only the state and notes - see the module doc comment. */
export const updateIssuedInvoiceSchema = z.strictObject({
  stateId: optionalUuidSchema,
  notes: optionalText(FIELD_LABELS.observations),
});

export type UpdateIssuedInvoiceInput = z.output<typeof updateIssuedInvoiceSchema>;
