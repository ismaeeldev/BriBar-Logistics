/**
 * "Base imponible = tarifa + suplemento" (ERP roadmap Phase 4), as a pure
 * derivation backing the stored, CHECK-enforced `services.base_cents`
 * column — the same relationship `calculateMileage` has to `actual_km`/
 * `service_km` (SRS 10.1): the formula lives once, here, and
 * `service.service.ts` calls it everywhere `rateCents` or `supplementCents`
 * changes, rather than each call site re-deriving it.
 *
 * No imports (CLAUDE.md, `docs/architecture.md`).
 */

/**
 * `null` exactly when `rateCents` is `null` - a service with no rate has no
 * base at all, and therefore cannot be invoiced
 * (`services_issued_invoice_requires_billable`). A supplement with no rate
 * does not produce a partial base; it has nothing to add to.
 */
export function computeBaseCents(
  rateCents: number | null,
  supplementCents: number | null,
): number | null {
  if (rateCents === null) return null;
  return rateCents + (supplementCents ?? 0);
}
