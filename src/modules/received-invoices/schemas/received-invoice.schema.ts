/**
 * Received-invoice schemas (ERP roadmap Phase 3, `03Facturas_Recibidas`).
 *
 * Admin-only for this pass, same reasoning as `refuelling.schema.ts`. Unlike
 * a refuelling, `invoiceDate` **is** a field here — see the doc comment on
 * `ReceivedInvoice` in `schema.prisma` for why a transcribed document's own
 * date is not a "never trust the client" case. `invoiceCode`, `vatCents` and
 * `totalCents` remain server-owned; only the base amount is a client input.
 */
import { z } from 'zod';

import { FIELD_LABELS } from '@/lib/i18n/messages';
import {
  isoDateSchema,
  optionalText,
  optionalUuidSchema,
  requiredMoneySchema,
  uuidSchema,
  vatRateSchema,
} from '@/modules/shared/schemas/common';

export const createReceivedInvoiceSchema = z.strictObject({
  supplierId: uuidSchema,
  categoryId: uuidSchema,
  vehicleId: optionalUuidSchema,
  invoiceDate: isoDateSchema,
  base: requiredMoneySchema,
  vatRate: vatRateSchema,
  stateId: optionalUuidSchema,
  paymentMethodId: optionalUuidSchema,
  notes: optionalText(FIELD_LABELS.observations),
});

export type CreateReceivedInvoiceInput = z.output<typeof createReceivedInvoiceSchema>;

export const updateReceivedInvoiceSchema = createReceivedInvoiceSchema.partial();

export type UpdateReceivedInvoiceInput = z.output<typeof updateReceivedInvoiceSchema>;
