# 13. The refuelling module (ERP roadmap Phase 2)

**Status:** Accepted

## Context

`docs/erp-migration/README.md` §4 scopes Phase 2 as "Refuelling. Odometer
history, `km since last refuel`, consumption, per-refuel VAT." It is the
first module built on top of the Phase 1 finance core (ADR 0012) and the
first real consumer of two Phase 1 additions that had no caller until now:
`formatDocumentCode` (refuel codes) and the `LookupItem` table gaining a new
kind rather than a new table (gas stations).

Roadmap §6 D10 — "who enters refuelling and daily km: the driver, an
administrator, or either?" — is still an open client question, unanswered
when this module was built.

## Decision

**Admin-only, for now.** Unlike `Service`, there is no driver-facing create
path in this pass. `driverId` still records *whose* fill-up a refuel was,
because that is needed for the per-driver fuel reporting the roadmap's
Phase 6 analytics will want, but the only way to write that field today is
through an administrator's request. Extending create to a driver actor later
— mirroring `serviceService.create`'s `canCreateFor`/two-schema split (ADR
0010) — is additive once D10 is answered: `driverId` is already the field
that split would need, and nothing about this decision has to be undone to
add it.

**`baseCents`/`vatCents` are computed one specific way, not two.**
`baseCents` comes from `baseFromGross(totalCents, vatRate)` — the
spreadsheet's own `Base = Total/1.21`, generalised to all five rates by
Phase 1's `vat.ts`. `vatCents` is then `totalCents - baseCents` by
definition, **not** a second call to `applyVat(baseCents, vatRate).vatCents`.
Both round independently; on an input that lands exactly on a rounding
boundary the two approaches can differ by a cent, and the CHECK constraint
`refuellings_base_vat_sum` would then reject an entirely correct submission.
Subtraction-from-total is the one approach that makes the constraint
unconditionally true.

**`kmSinceLastRefuel` and its consumption figure are computed at read time,
not stored.** This is the one place this module's design differs from
`services.actual_km`/`service_km`, which SRS 10.1 has stored precisely so
reporting never recomputes them. The two cases differ in a way that matters:
a service's calculated columns depend only on that service's own four
readings, so storing them can never go stale. A refuel's odometer delta
depends on a *different row* — the chronologically previous refuel for the
same vehicle — and that "previous" relationship can change after the fact
whenever a backdated entry is corrected or a mistaken one is deleted. A
stored value would then be silently wrong until someone thought to
recalculate it; a value computed by `refuelling.service.ts` on every read
(`refuellingRepository.previousForVehicle`, then
`domain/consumption.ts`'s pure `kmSinceLast`/`consumptionMlPer100Km`) is
correct by construction and costs one extra indexed query per detail-page
view, not per list-page row — see "Consequences" for the scaling note that
follows from that.

**Odometer ordering is a service-layer concern, not a CHECK constraint.**
"The odometer only ever increases" is a rule about the ordering of two
different rows for the same vehicle, which a single-row CHECK constraint
cannot express, and this codebase has no trigger precedent to reach for
instead (`services_mileage_sequence` and its neighbours all constrain columns
*within* one row). Rather than introduce triggers for this first pass,
out-of-order data is tolerated at the database level and made inert at the
domain level: `kmSinceLast` returns `null` for a non-positive delta instead
of a wrong distance (`domain/consumption.ts`'s doc comment), so a backdated
or mis-keyed entry shows as "not enough data" rather than reporting a
plausible-looking wrong number.

**A polymorphic reference, revalidated at the boundary.** `fuel_type_id` and
`gas_station_id` are foreign keys into the same `lookup_items` table (ADR
0012's `LookupKind` design), and a foreign key alone cannot express "must be
a `FUEL_TYPE`-kind row." `assertLookupKind` in `refuelling.service.ts`
re-fetches the referenced row and checks its `kind` on every create and
update, the same "service layer owns anything needing a query" principle
(`docs/architecture.md`) that already governs `routeId`/`vehicleId` on a
service. A legitimate request can never trip this — the admin form's selects
are each populated from one kind only — so it exists for the same reason
`driverNotAllowed` exists on `Service`: a hand-crafted request, not a real
user flow.

> **Update, 2026-09-17.** `payment_method_id` was a third such reference,
> made mandatory on 2026-09-13 at the client's own request (see
> `refuelling.schema.ts`'s former doc comment on `createRefuellingSchema`).
> The
> 2026-09-17 change-request document asks for it to be removed from this
> module outright — not made optional, dropped: the column, the form field
> and `assertLookupKind`'s third call are all gone
> (`prisma/migrations/20260916213318_refuelling_drop_payment_method`).
> `LookupKind.PAYMENT_METHOD` itself is untouched, because
> `ReceivedInvoice.paymentMethodId` is a separate reference into the same
> kind and was not part of this request.

## Consequences

**No driver-facing entry path, no mobile UX to design or maintain yet.**
Correct scope for an unanswered D10, and the cheapest possible position to
extend from once it is answered.

**The detail page's "km since last refuel" query is one extra read per
view, not per list row.** The admin refuelling list intentionally does not
show these figures — only the detail/edit page does — so this module never
runs the previous-refuel query once per row in a paginated list. If a future
phase's per-vehicle consumption report needs the figure for many refuels at
once, that is Phase 6's aggregate-query territory (roadmap §3.4), and it
would use a window function over `refuellings_vehicle_id_refuel_date_idx`
rather than this module's per-row lookup — a decision for that phase, not a
retrofit onto this one.

**A wrongly-keyed odometer reading is silently unhelpful rather than loudly
wrong.** An administrator correcting a backdated entry sees "not enough data
to calculate consumption" on the affected rows rather than an error pointing
at what to fix. Acceptable for a first version of a module with no approval
workflow and free editing; worth revisiting if backdated entries turn out to
be common enough that the silence itself becomes the problem.

**Gas stations joined `LookupKind` rather than becoming a `Supplier`-style
entity.** The roadmap's own §2 lists "gas stations" and "suppliers" as
separate master-data categories, and nothing about a gas station needs more
than a name for what this module does with it — unlike `Supplier`, which
ADR 0012 deferred specifically because Phase 3's received-invoices category
rule needs to shape it first. If a gas station later needs its own address
or contract terms, promoting it out of `LookupItem` is a new model plus a
migration of existing rows, not a rewrite of what points at it — the same
promotion path ADR 0012 already committed to for `End client`.
