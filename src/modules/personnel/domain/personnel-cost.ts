/**
 * "Coste fijo diario = Coste total / días del mes" (ERP roadmap Phase 5,
 * `04_Personal`), as a pure derivation.
 *
 * Deliberately not a stored, CHECK-enforced column the way
 * `services.base_cents` is — see the doc comment on `PersonnelCost` in
 * `schema.prisma` for why: the divisor depends on which month it is, and
 * hand-rolling that formula identically in SQL and in application code
 * risks the two disagreeing at a month boundary for no benefit this phase's
 * own screens need.
 *
 * No imports (CLAUDE.md, `docs/architecture.md`).
 */

/**
 * The number of days in a calendar month, leap years included.
 *
 * `new Date(year, month, 0)` is the standard trick: JavaScript's `Date`
 * normalises an out-of-range day, so "the 0th of next month" is the last day
 * of *this* month. `month` here is 1-12 (this file's own convention, matching
 * `fiscal-period.ts`), so passing it unadjusted as the "next month" argument
 * is correct, not an off-by-one.
 *
 * Local-time `Date` accessors, not UTC — unlike `time-of-day.ts`'s documented
 * UTC discipline, this never crosses the local/UTC boundary at all: the value
 * is constructed and read back in the same (local) representation, so there
 * is no server-offset shift to guard against, only calendar arithmetic.
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** `Math.round(totalCents / daysInMonth(year, month))`. */
export function computeDailyFixedCostCents(totalCents: number, year: number, month: number): number {
  return Math.round(totalCents / daysInMonth(year, month));
}
