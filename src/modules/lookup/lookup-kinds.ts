/**
 * The known lookup kinds, as a value — `LookupKind` (`@prisma/client`) is
 * only a type, and the landing page (`/admin/lists`) and the dynamic
 * `[kind]` route both need something to iterate over and validate against.
 *
 * Adding a fifth simple list is one entry here plus the dictionary label
 * (`LOOKUP_KIND_LABELS`) and the enum value in `schema.prisma` — no new
 * repository, service, schema, page or route handler.
 */
import type { LookupKind } from '@prisma/client';

// `END_CLIENT` is deliberately absent — promoted to its own `EndClient`
// model (client change request 2026-09-17, `/admin/end-clients`), so it is
// no longer offered as a generic named list here.
export const LOOKUP_KINDS: readonly LookupKind[] = [
  'FUEL_TYPE',
  'PAYMENT_METHOD',
  'SUPPLEMENT_TYPE',
  'GAS_STATION',
  'INVOICE_STATE',
  'MAINTENANCE_TYPE',
  'CLIENT_PAYMENT_METHOD',
];

export function isLookupKind(value: string): value is LookupKind {
  return (LOOKUP_KINDS as readonly string[]).includes(value);
}
