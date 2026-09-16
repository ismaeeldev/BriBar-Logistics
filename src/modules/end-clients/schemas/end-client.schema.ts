/**
 * End client ("Cliente final") master-data schemas. Mirrors
 * `client.schema.ts` — promoted from `LookupKind.END_CLIENT` to its own
 * model (client change request 2026-09-17).
 */
import { z } from 'zod';

import { FIELD_LABELS } from '@/lib/i18n/messages';
import { booleanSchema, optionalText, requiredText } from '@/modules/shared/schemas/common';

export const END_CLIENT_NAME_MAX_LENGTH = 160;
export const END_CLIENT_TAX_ID_MAX_LENGTH = 32;

export const createEndClientSchema = z.strictObject({
  name: requiredText(FIELD_LABELS.endClient, END_CLIENT_NAME_MAX_LENGTH),
  taxId: optionalText(FIELD_LABELS.taxId, END_CLIENT_TAX_ID_MAX_LENGTH),
  isActive: booleanSchema.default(true),
});

export type CreateEndClientInput = z.output<typeof createEndClientSchema>;

/**
 * Deactivation, not deletion, is the removal path once an end client is
 * referenced by a route — the same rule every other master-data entity
 * follows (SRS 21.5).
 */
export const updateEndClientSchema = createEndClientSchema.partial();

export type UpdateEndClientInput = z.output<typeof updateEndClientSchema>;
