# 16. Daily real km, personnel costs, and maintenance (ERP roadmap Phase 5)

**Status:** Accepted

## Context

`docs/erp-migration/README.md` §4 scopes Phase 5 as three sheets that were
not yet modelled: `00KmDiariosReales` (a daily odometer/hours log per
vehicle), `04Personal` (a monthly cost per employee), and `05Mantenimiento`
(a maintenance history with URGENTE/PRÓXIMO/OK due-soon alerts). Nothing
built in Phases 0–4 covers any of the three; unlike Phase 4, this phase
depends on no unfinished earlier decision.

Two of the roadmap's open questions (§6) touch this phase directly:

- **D12** asks whether the maintenance due-date engine is complete as
  "+15,000 km / +6 months" or whether other maintenance types carry their
  own intervals, and remains unanswered.
- The sheet gives no schema for "current odometer" — Phase 2's `Refuelling`
  and this phase's own `DailyKmLog` each carry a reading, independently.

## Decision

**Three separate tables, not one generic log.** `DailyKmLog`,
`PersonnelCost` and `MaintenanceRecord` model three unrelated real-world
events (a day's driving, a month's pay, a repair) that happen to share
"logged against a vehicle or a person, over time." A single `Log` table
with a polymorphic `kind` column would recreate exactly the ambiguity the
`LookupItem` design (ADR 0012) deliberately avoids for anything with more
than a name: "which columns are valid for this row" would depend on
`kind`, checked in application code instead of the schema. Three tables
keep every column meaningful for every row of its own table, and let each
carry its own CHECK constraints and its own foreign keys.

**`nextDueKm`/`nextDueDate` are administrator-entered, not computed from an
interval rule.** D12 is unanswered, and guessing "+15,000 km / +6 months"
as a hard-coded formula would silently misfile any maintenance type the
spreadsheet's own author had a different interval in mind for (an oil
change and an ITV inspection are not on the same clock). Instead
`MaintenanceRecord` stores whatever due signal — either, both, or neither —
the administrator supplies when logging the work, and
`maintenanceUrgency()` (`domain/maintenance-urgency.ts`) reads back
whichever of the two is present. The day D12 is answered with a concrete
per-type rule, computing `nextDueKm`/`nextDueDate` automatically from
`maintenanceTypeId` is a service-layer change behind the same field names —
nothing downstream (the urgency function, the due-summary view, the form)
needs to change shape.

**The URGENT/UPCOMING/OK/UNKNOWN bands, and their thresholds, live in one
pure function with named, exported constants.** `maintenanceUrgency()`
takes `nextDueKm`/`currentKm`/`nextDueDate`/`today` and returns the more
urgent of the km-based and date-based signals, `UNKNOWN` only when neither
signal is available at all. `URGENT_KM_THRESHOLD` (500 km),
`UPCOMING_KM_THRESHOLD` (2,000 km), `URGENT_DAY_THRESHOLD` (14 days) and
`UPCOMING_DAY_THRESHOLD` (30 days) are explicitly documented as a
provisional default, not a client answer — nothing in the sheet states how
many kilometres or days count as "urgent" versus merely "upcoming." Keeping
them as named constants in one dependency-free file means the day D12 (or
a separate answer about banding) arrives, there is exactly one place the
numbers change, not a search across the service layer and the UI for a
magic `500`.

**"Current odometer" is synthesised from whichever of `Refuelling` and
`DailyKmLog` is more recent, not modelled as its own field.**
`maintenanceRecordService`'s `currentOdometerKm` reads
`refuellingRepository.previousForVehicle` and
`dailyKmLogRepository.mostRecentForVehicle` for a vehicle and takes the
higher of the two readings — a vehicle need not have both logs, and
neither log is complete on its own. This mirrors ADR 0013's own precedent
(`Refuelling.kmSinceLastRefuel`) one level further: rather than add a
column that would need reconciling against two other tables on every
write, the figure is computed at read time from data that already exists.

**`dailyFixedCostCents` is computed at read time, never stored.** A
`PersonnelCost`'s `totalCents` divided by the number of days in its own
`year`/`month` is not expressible as a single formula shared safely between
a CHECK constraint (SQL) and the service layer (JavaScript) — the divisor
changes by month, and a SQL rounding rule quietly diverging from a JS one
is exactly the risk ADR 0013 named for `kmSinceLastRefuel`. `totalCents`
itself, by contrast, **is** stored and CHECK-enforced
(`personnel_costs_total_formula`): `base + overtime + allowances + other`
is fixed-shape addition with no such ambiguity, the same reasoning ADR
0015 gave for `services.base_cents`.

**`MaintenanceRecord` carries no cost.** Cost tracking already has a home —
`ReceivedInvoice`, categorised under `ExpenseCategory` (ADR 0014) — and a
second cost field on `MaintenanceRecord` would either duplicate it or
silently diverge from it. This module stays scoped to *when* work was done
and *when* it is next due; what it cost is a received invoice like any
other garage bill.

## Consequences

**Three more foreign keys land on `Vehicle`, `Route`, `User` and
`LookupItem`.** `vehicleRepository.countDependents` gained `dailyKmLogs`
and `maintenanceRecords`; `routeRepository.countDependents` (and
`routeService.getDeletability`/`remove`) gained `dailyKmLogs`;
`userRepository.countDependents` gained `dailyKmLogs` and
`personnelCosts` — and, caught in the same pass, a Phase 2 gap where
`refuellings` had never been added despite `Refuelling.driverId`
referencing `User` since that phase shipped; `lookupRepository
.countDependents` gained `maintenanceRecords` for the new
`MAINTENANCE_TYPE` kind. This is the same "every new FK needs its
target's `countDependents` updated" discipline every earlier phase in
this session has hit (ADR 0012–0015's own consequences sections record the
same pattern for `Client`, `Vehicle`, `Route` and `LookupItem` in turn).

**A fifth `lookup_kind`.** `MAINTENANCE_TYPE` joins `FUEL_TYPE`,
`PAYMENT_METHOD`, `SUPPLEMENT_TYPE`, `END_CLIENT`, `GAS_STATION` and
`INVOICE_STATE` as a seventh member of the same generic simple-list
pattern (ADR 0012) — administrators manage maintenance types the same way
they manage fuel types, from `/admin/lists`, with no new UI of its own.

**A new nav section.** Daily km logs, personnel costs and maintenance did
not fit "Master data" (they are not set-up-once real-world entities) or
"Finance" (personnel costs are a cost, but daily km logs and maintenance
are not financial records) cleanly, so `nav-items.ts` gained a fifth
section, "Fleet & personnel" — the same "how often is this visited, not
merely what it is" principle the existing four groups already follow.

**Recovery/margin per vehicle is still not built.** ADR 0014 and 0015 both
deferred this to Phase 6; this phase adds personnel cost as one more input
a genuine per-vehicle profit calculation will need, but assembling that
calculation remains Phase 6's job, not a side effect of this phase adding
the data.
