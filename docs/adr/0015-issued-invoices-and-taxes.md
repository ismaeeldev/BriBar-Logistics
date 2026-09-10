# 15. Issued invoices, service billing, and the tax summary (ERP roadmap Phase 4)

**Status:** Accepted

## Context

`docs/erp-migration/README.md` §4 scopes Phase 4 as "Issued invoices + Taxes.
Group approved services into a client invoice; `Base = Σ service base`;
quarterly IVA soportado/repercutido." Two things it depends on were not
finished by earlier phases:

- **"Service base" did not exist.** Client change request 2026-09-09 item 4
  described "Base imponible = tarifa + suplemento", but Phase 0 built only
  the rate half — the roadmap's own §6 open-question list explicitly deferred
  the supplement to "this phase or the invoicing phase later" pending client
  input that never arrived. Phase 4 cannot compute "Σ service base" without
  it, so this phase builds it now.
- **Nothing said which client a service belongs to.** ADR 0012 deferred this
  exact question — "which join is Phase 4's decision" — when it built
  `Client` in Phase 1.

## Decision

**The supplement, and `services.base_cents`, follow rate's exact shape.**
`supplementCents`/`supplementTypeId` are admin-only fields with their own
`ServiceSupplementEditor`, edited outside `canEdit` the same way
`updateRate` already is (ADR-adjacent Phase 0 reasoning) — a driver's own
pending/approved rules have no bearing on billing information a driver never
sees at all. `baseCents = rateCents + COALESCE(supplementCents, 0)` is
stored and CHECK-enforced (`services_base_formula`), the same "calculated
column, never re-derived, guaranteed by a constraint" pattern SRS 10.1 set
for `actual_km`/`service_km` — because `IssuedInvoice`'s "Σ service base"
is exactly the cross-row aggregation SRS 10.1's rationale exists for.
`computeBaseCents` (`domain/billing.ts`) is the one place the formula is
written, called from both `updateRate` and `updateSupplement` so a change to
either operand always leaves the stored base consistent with whichever
operand *wasn't* touched.

**A service reaches its client through its route, not directly.** Roadmap
§6 B4 resolved "Contrato vs. Route" as "Contrato = Route" before Phase 1
started (see ADR 0012 and the client-facing question list from that
session). A contract is with a client by definition, so `Route.clientId`
(admin-only, mirroring `defaultRateCents`) is where the fact belongs; asking
an administrator to also pick a client on every individual service would be
asking for something the route already states, and would let a service and
its own route disagree about whose contract it fell under. The
invoice-creation picker (`issuedInvoiceRepository.billableServicesForClient`)
queries services through `route: { clientId }`, never a column on `Service`
itself.

**An issued invoice is immutable in the way that matters, and freely
editable in the way that doesn't.** `issuedInvoiceService.update` accepts
only `stateId` and `notes` — not the client, date, VAT rate, or which
services were grouped. This is the one place this session's ERP work departs
from the "administrators can freely correct anything" shape `Refuelling` and
`ReceivedInvoice` both have. The reasoning: `baseCents` here is not a typed
value that might have a typo to fix, it is `Σ` of specific services'
`baseCents` at a specific moment — editing it in place would silently
detach the number from the services it is supposed to represent. The
correction path is instead **delete and reissue**: deleting frees every
grouped service back to billable (`services.issued_invoice_id` is
`ON DELETE SET NULL`, not `Restrict` — the one foreign key in this schema
that isn't, and the doc comment on `Service.issuedInvoiceId` says why), and
a corrected invoice is created fresh with the right services and the right
total.

**Every request is re-validated against the same billable set the picker
offered, never trusted for it.** `issuedInvoiceService.create` re-derives
`billableServicesForClient(clientId)` and checks every requested
`serviceId` is in it — approved, priced, unbilled, and on *this* client's
own routes — before summing anything. This is SRS 22.4's "never trust
calculated or gated values from the browser" discipline, applied to a
module the SRS does not cover: a hand-crafted request naming another
client's service, or a still-pending one, is refused the same way a driver
naming another driver's route already is (`service.service.ts`).

**The tax summary is computed in application code, not SQL `GROUP BY`.**
`taxService.quarterlySummary` fetches every invoice's date and VAT
(`allForTaxSummary` on both invoice repositories) and buckets them with the
Phase 1 `fiscalPeriodFromParts` domain helper — the same pure function
Phase 1 built and nothing had called yet. The alternative, a raw SQL
`EXTRACT(QUARTER FROM invoice_date)` query, would duplicate the
`ROUNDUP(month/3,0)` quarter rule in a second language the moment the
formula ever needed adjusting. For the row counts this system deals in (a
trucking company's own invoices), grouping in Node costs nothing worth
optimising away.

## Consequences

**`services_base_formula`'s backfill mattered more than usual.** Every
existing service predates `base_cents`; without an `UPDATE` setting it from
`rate_cents` before the `CHECK` constraint was added, the migration would
have failed outright on the first already-priced service in the table —
caught before applying, but worth naming as the reason the migration file
has an explicit backfill step most of this session's earlier migrations
didn't need.

**Two invoice tables now both reference `lookup_items`
(`INVOICE_STATE`) and both get their own `VatRate`-typed forward VAT
calculation** — `ReceivedInvoice` and `IssuedInvoice` are close enough in
shape that `lookupRepository.countDependents` now sums a fifth and sixth
family of FK columns into the blockers `toDeletability` reports (ADR
0012/0013's running list).

**No line-item VAT.** `IssuedInvoice` carries one `vatRate` for the whole
invoice, matching `05Facturas_Emitidas`'s own columns ("IVA, Total" at the
invoice level, not per service). If a future client requirement needs mixed
rates on one invoice, that is a new column on the join between `Service` and
`IssuedInvoice` (currently a bare foreign key), not a change to either
invoice model.

**Recovery/payback, and per-vehicle margin, are still not built.** ADR 0014
already deferred `07_Inversiones`'s recovery figure to Phase 6; this phase's
"Base = Σ service base" is the last missing input for a genuine per-vehicle
profit calculation (revenue now exists; costs already did from Phases 2–3),
but assembling that calculation is still Phase 6's analytics layer, not a
side effect of Phase 4 shipping the last number it needed.
