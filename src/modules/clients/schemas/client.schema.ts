/**
 * Client master-data schemas (ERP roadmap Phase 1, roadmap §2 "New entities
 * V1 does not have").
 */
import { z } from 'zod';

import { FIELD_LABELS } from '@/lib/i18n/messages';
import { booleanSchema, optionalText, requiredText } from '@/modules/shared/schemas/common';

export const CLIENT_NAME_MAX_LENGTH = 160;
export const TAX_ID_MAX_LENGTH = 32;

export const createClientSchema = z.strictObject({
  name: requiredText(FIELD_LABELS.name, CLIENT_NAME_MAX_LENGTH),
  taxId: optionalText(FIELD_LABELS.taxId, TAX_ID_MAX_LENGTH),
  /** New clients are selectable immediately unless told otherwise. */
  isActive: booleanSchema.default(true),
});

export type CreateClientInput = z.output<typeof createClientSchema>;

/**
 * Deactivation, not deletion, is the removal path once a client is
 * referenced elsewhere — the same rule every other master-data entity
 * follows (SRS 21.5). Nothing references a client yet, so today `remove()`
 * always succeeds; this schema and `getDeletability` are already shaped for
 * the day something does.
 */
export const updateClientSchema = createClientSchema.partial();

export type UpdateClientInput = z.output<typeof updateClientSchema>;
