/**
 * Simple-lookup-list schemas (ERP roadmap Phase 1) — fuel types, payment
 * methods, supplement types, end clients (`prisma/schema.prisma`'s
 * `LookupKind`).
 *
 * `kind` is never a field here. It is server-owned, supplied by the route
 * segment the request came in on (`/admin/lists/[kind]`), the same reason
 * `driverId` has no place in the driver's own `createServiceSchema` — a
 * request that could pick its own `kind` could file a fuel type into the
 * payment-methods list.
 */
import { z } from 'zod';

import { FIELD_LABELS } from '@/lib/i18n/messages';
import { booleanSchema, requiredText } from '@/modules/shared/schemas/common';

export const LOOKUP_NAME_MAX_LENGTH = 120;

export const createLookupItemSchema = z.strictObject({
  name: requiredText(FIELD_LABELS.name, LOOKUP_NAME_MAX_LENGTH),
  isActive: booleanSchema.default(true),
});

export type CreateLookupItemInput = z.output<typeof createLookupItemSchema>;

export const updateLookupItemSchema = createLookupItemSchema.partial();

export type UpdateLookupItemInput = z.output<typeof updateLookupItemSchema>;
