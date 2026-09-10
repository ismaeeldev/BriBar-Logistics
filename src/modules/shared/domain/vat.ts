/**
 * VAT ("IVA"), as a pure calculation (ERP roadmap Phase 1, roadmap §3.1).
 *
 * The Excel ERP's rates are a closed set — `99_Listas` names exactly five —
 * and every sheet that touches tax (`02Repostajes`, `03Facturas_Recibidas`,
 * `05Facturas_Emitidas`, `06_Impuestos`) applies one of them to an amount
 * already known in cents. `applyVat`/`baseFromGross` are that arithmetic,
 * factored out once so every later module (refuelling, invoices, taxes) calls
 * the same function rather than re-deriving `Total / 1.21` in its own form.
 *
 * No imports, by convention (`domain/` — CLAUDE.md, `docs/architecture.md`):
 * this file is unit-tested on its own and never needs a database, a schema
 * library or a framework to be correct.
 */

/** The rates the client's spreadsheet actually uses (`99_Listas`). */
export type VatRate = 'STANDARD' | 'REDUCED' | 'SUPER_REDUCED' | 'ZERO' | 'EXEMPT';

/**
 * Percentage points for each rate. `ZERO` and `EXEMPT` are both 0% — kept as
 * separate rates rather than collapsed into one because they mean different
 * things on an invoice (a taxable supply at a 0% rate vs. a genuinely
 * VAT-exempt one), which is exactly the distinction `99_Listas` draws with its
 * "0% (exento)" entry.
 */
export const VAT_RATE_PERCENT: Record<VatRate, number> = {
  STANDARD: 21,
  REDUCED: 10,
  SUPER_REDUCED: 4,
  ZERO: 0,
  EXEMPT: 0,
};

/**
 * Splits a tax-exclusive amount into its VAT and gross total.
 *
 * Rounds to the nearest cent at the end, not at an intermediate step — the
 * project's standing rule for money (see `src/lib/money/money.ts`): amounts
 * are integer cents everywhere, and a single rounding point is what keeps
 * `baseCents + vatCents === totalCents` true for every input.
 */
export function applyVat(
  baseCents: number,
  rate: VatRate,
): { vatCents: number; totalCents: number } {
  const vatCents = Math.round((baseCents * VAT_RATE_PERCENT[rate]) / 100);
  return { vatCents, totalCents: baseCents + vatCents };
}

/**
 * The inverse: recovers the tax-exclusive base from a tax-inclusive total.
 *
 * The spreadsheet's own formula (`02Repostajes`: `Base = Total/1.21`) reads a
 * pump receipt's all-in price and needs the pre-tax amount for its margin
 * calculations; this is that division, expressed over integer cents rather
 * than a float, and rounded once rather than left to accumulate error across
 * a year of refuels.
 */
export function baseFromGross(grossCents: number, rate: VatRate): number {
  return Math.round((grossCents * 100) / (100 + VAT_RATE_PERCENT[rate]));
}
