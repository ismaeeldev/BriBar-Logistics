/**
 * Year / month / quarter, as a pure derivation (ERP roadmap Phase 1, roadmap
 * §3.2).
 *
 * Every financial sheet in the client's Excel ERP derives these three from a
 * date column with `=YEAR()`, `=MONTH()`, `=ROUNDUP(MONTH()/3,0)` and then
 * filters or pivots on them. Stored as separate columns in the app they would
 * be redundant with the date and able to drift from it; this file is the
 * single place the derivation happens, so every module that needs "by month"
 * or "by quarter" filtering computes it from the same rule via a query
 * expression, not a value that was written once and never rechecked.
 *
 * Takes plain numbers, not a `Date` — the point of `domain/` staying
 * dependency-free (CLAUDE.md, `docs/architecture.md`) is that this file
 * imports nothing, and `src/lib/time/business-date.ts` already owns turning
 * an instant into a calendar day in `APP_TIMEZONE`. Callers resolve a real
 * date to a day first and hand this file the parts.
 */

export interface FiscalPeriod {
  year: number;
  /** 1-12. */
  month: number;
  /** 1-4, `ROUNDUP(month/3, 0)`. */
  quarter: number;
}

/** `ROUNDUP(month/3, 0)` — the spreadsheet's own formula, unrounded division. */
export function quarterOfMonth(month: number): number {
  return Math.ceil(month / 3);
}

/**
 * Builds a `FiscalPeriod` from a calendar year and month.
 *
 * `month` is 1-12 (calendar convention, matching the spreadsheet's `MONTH()`
 * and `src/lib/time/time-of-day.ts`'s own preference for human-facing units
 * over zero-indexed ones) — not JavaScript's zero-indexed `Date.getMonth()`.
 * A caller converting from a `Date` must add 1.
 */
export function fiscalPeriodFromParts(year: number, month: number): FiscalPeriod {
  return { year, month, quarter: quarterOfMonth(month) };
}
