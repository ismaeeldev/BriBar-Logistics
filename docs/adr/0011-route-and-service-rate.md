# 11. Route default rate and per-service rate, admin-only

**Status:** Accepted

## Context

Client change request 2026-09-09, item #4 (also the first slice of the ERP
migration roadmap, `docs/erp-migration/README.md` Phase 0): "Route should have
an admin-only default rate; driver must never see rates/pricing; admin
reviewing a service before approval must see and be able to modify the
assigned rate."

Nothing in the schema carried a price before this. The SRS is silent on
billing entirely — it belongs to the client's Excel ERP, which this and later
phases migrate into the app one module at a time (see the roadmap doc for the
full plan and the open questions gating the phases after this one).

## Decision

**Two columns, one snapshot.** `routes.default_rate_cents` is the price an
administrator sets once on the route master. `services.rate_cents` is a copy
taken at service creation — the same pattern SRS 14.5 already established for
`origin_snapshot`/`destination_snapshot`: what applied to *this* service is
what the service remembers, not whatever the master record says today.
Editing a service through the normal driver/admin edit form never touches
`rate_cents`; only a dedicated `serviceService.updateRate()` can, and it does
not re-derive the value from the route even if the route's default has since
changed.

**Integer cents, not a float.** Mirrors the existing money-adjacent
convention that mileage is stored as `Int`, never a floating-point number.
`src/lib/money/money.ts` provides the euros↔cents conversions and formatting;
`moneySchema` (`src/modules/shared/schemas/common.ts`) is a three-way field —
absent key leaves the value unchanged, an explicit blank string clears it to
`null`, anything else parses as an amount — because an HTML form always
resubmits every field, so "blank means unchanged" (the convention
`optionalText` uses for free text) would make a rate impossible to ever
clear.

**Visibility is enforced in the presenter layer, not the repository.**
`SERVICE_INCLUDE` uses Prisma's `include`, so every scalar column — including
`rate_cents` — reaches every caller of `serviceRepository.findByIdForActor`
regardless of role; narrowing that query per-role would be a larger, riskier
change than the one this ships. Instead, `service.presenter.ts` adds
`toAdminServiceDetail()` alongside the existing `toServiceDetail()`: the
former adds `rateCents`, the latter — the one the driver-facing pages call —
never does. This is the single point where "the driver must never see rates"
is actually true; nothing downstream of it can leak the field by accident,
but nothing upstream of it is a safety net either, so a new admin route that
happens to reuse `toServiceDetail()` gets no rate, and a new driver route that
reaches for `toAdminServiceDetail()` by mistake would need to be caught in
review, not by the type system.

**CHECK constraints, not just Zod.** `routes_default_rate_non_negative` and
`services_rate_non_negative` (`col IS NULL OR col >= 0`) back up
`isEurosAmount`'s rejection of negative amounts at the database, the same
belt-and-suspenders approach as the mileage and time-ordering constraints —
a direct write that skips the service layer still cannot store a negative
price.

## Consequences

A service created before this shipped, or on a route with no default rate
set, simply has `rateCents: null` — there is no backfill. `ServiceRateEditor`
renders "Sin tarifa asignada" for that case rather than a zero, so an unset
rate is never confused with a €0.00 one.

Changing a service's route after creation (via the general edit form) does
not re-snapshot the rate — the two fields are independent once the service
exists, consistent with how origin/destination already behave on a route
change.

The rate does not yet appear on the admin services list, only on the
service detail/review page — matching the change request's literal scope
("admin reviewing a service before approval must see... the assigned rate").
Whether it belongs on the list too, and whether a "supplement" on top of the
base rate (`Base imponible = tarifa + suplemento` in the client's Excel) is
needed in this phase or the invoicing phase later, are open questions for the
client — see the question list raised alongside this change.
