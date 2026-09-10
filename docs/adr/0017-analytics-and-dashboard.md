# 17. Analytics and dashboard (ERP roadmap Phase 6)

**Status:** Accepted

## Context

`docs/erp-migration/README.md` §3.4 and §4 scope Phase 6 as the replacement
for the spreadsheet's `00Dashboard` / `00Análisis` / `90_Modelo` sheets —
"~55 `SUMIFS`/`XLOOKUP` formulas over the transaction tables, filtered by
year/month/vehicle". By this phase every module those formulas read from
exists (Phases 2–5), so the work is the reporting layer itself:

- operating margin per month and per vehicle,
- vehicle utilisation (real km, service km, empty km),
- fuel efficiency (€/L, L/100km, €/km),
- per-contract €/km, efficiency and estimated-fuel margin,
- per-driver services, days, km, revenue/km, average ticket,
- per-vehicle investment recovery (deferred here by ADR 0014),
- the scenario simulator (§4).

Quarterly VAT (`taxService`, Phase 4) and the maintenance-due bands
(`maintenanceRecordService.dueSummary`, Phase 5) are already built; this
phase leaves them where they are and links to them.

## Decision

**A derived module, no schema.** `src/modules/analytics/` has a
`domain/`, a `repository/` and a `service/`, but no model, no migration and
no table — the same shape as `taxService` (Phase 4) and
`receivedInvoiceService.investmentSummary` (Phase 3). Every figure is
recomputed from the transaction tables on each page load. For a trucking
company's own history — 140 services, 46 refuels, 90 invoices, ~14 personnel
months (roadmap §2) — a materialised summary would be caching work to avoid
work that does not exist.

**The grouping is application code, not SQL `GROUP BY`.** `analyticsRepository`
methods are projections — the few columns each aggregate needs, for every
row, unscoped — and `analyticsService` buckets them by year/month / vehicle
/ contract / driver in TypeScript, with the same UTC-date-to-calendar-parts
discipline `taxService` uses (`date.getUTCFullYear()` /
`date.getUTCMonth() + 1`, so the server's offset never shifts which month a
row lands in) and the `domain/analytics-math` formulas. This is ADR 0015's
decision for `taxService`, applied again for the same reason:
`EXTRACT(YEAR/MONTH FROM …)` would put the period rule in a second language,
and the row counts make the round trip free. It also keeps every formula
(`€/km`, `L/100km`, empty km, margin, recovery) in one dependency-free file
the unit suite exercises directly.

**`domain/analytics-math.ts` returns `null`, never `0`/`NaN`/`Infinity`, for
an undefined ratio.** Every per-km / per-litre / per-service figure divides
by a quantity that is legitimately zero early on (a vehicle with no service
km yet, a month with no refuels). `safeRatio` returns `null` — "not enough
data to say" — and the page renders it as `—`. `0` would read as a real
figure; `NaN`/`Infinity` break formatting.

**A separate page, not a rebuilt `/admin`.** The operational dashboard at
`/admin` (SRS 16.1/16.2 — pending approvals, today vs. yesterday, the 14-day
activity trend) stays exactly as it is. `/admin/analytics` is the financial
and operational analysis layer beside it, in the Operations nav section. The
two answer different questions: `/admin` is "what needs me today",
`/admin/analytics` is "how is the fleet doing". Merging them would bury the
approval queue under a wall of margin tables.

**Personnel cost is fleet-level only.** `04_Personal` is a monthly total per
employee with no vehicle or contract attached, and the spreadsheet's own
per-vehicle and per-contract analysis does not split it either. It appears
in the **fleet-wide** monthly margin (`overview`, `monthlyMargin`); the
per-vehicle and per-contract margins are revenue minus the costs that *can*
be attributed (fuel and operating expense for a vehicle; estimated fuel at
the standard rate for a contract). The doc comment on `analyticsService`
says so, so a reader does not mistake the per-vehicle margin for a full P&L.

**"Revenue" is `Σ services.base_cents`, not `Σ issued-invoice totals.**
Phase 4 made `base_cents` (rate + supplement) a stored column on every
priced service. Summing it counts revenue as it is earned, service by
service, rather than only once it has been grouped onto an issued invoice —
which for a closed month is the same number, and for the current month is
the more useful one. A service with no rate contributes `0` (and is still
counted in `serviceCount`).

**Per-contract margin uses *estimated* fuel, per the sheet.** `00Análisis`'s
"margen operativo" for a contract is `facturación − combustible estimado`,
where estimated fuel is the distance at `AppConfig`'s default consumption
and price (`estimatedFuelCents`). Actual refuels are not attributed to a
contract — a refuel names a vehicle, not a route — so the estimate is the
only per-contract fuel figure available, and matching the sheet's choice
keeps the app's number comparable to the one the client already trusts.

**The scenario simulator is client-side and shares the domain math.**
`ScenarioSimulator` (`'use client'`) recomputes margin from
`domain/analytics-math` as the fields change — the same `estimatedFuelCents`
/ `marginCents` / `safeRatio` the real figures use, so a projection and a
report can never disagree about how margin is defined. It is seeded with the
current period's actuals and saves nothing.

## Consequences

**No new foreign keys, no `countDependents` churn.** For the first time
since Phase 0, a phase adds no column to an existing table, so none of the
running `countDependents` / `Deletability` / `prisma-errors` updates every
earlier phase needed apply here.

**`analyticsRepository` reaches across seven tables.** It reads `service`,
`refuelling`, `received_invoice` (joined to `expense_category` for the
`expenseType`), `personnel_cost`, `daily_km_log`, `vehicle`, `route` and
`user`. This is the one repository in the codebase that is not scoped to a
single model — deliberately, because a reporting layer's job *is* to join
across modules, and putting the projections here keeps that concern out of
the eight operational repositories (`serviceRepository` etc.), which stay
scoped to their own model and their own visibility rules.

**Investment recovery is all-time and ignores the filter.** A recovery
figure for a single month is meaningless — the investment was sunk once, and
profit accumulates against it over the vehicle's whole life. `investmentRecovery`
takes no filter; the page shows it as its own section, not part of the
period view.

**Still no data import.** Phase 7 (the one-time Excel import and cutover)
remains the last phase. Until it runs, these analytics describe whatever has
been entered through the app's own forms, not the client's full history.
