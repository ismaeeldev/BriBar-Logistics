/**
 * Fuel volume as integer millilitres (ERP roadmap Phase 1, `99_Config`).
 *
 * The same reasoning as `src/lib/money/money.ts`, applied to litres instead of
 * euros: the config screen's default consumption is a rate with one decimal
 * place of real precision (`11 L/100km`, `99_Config`), and storing it as a
 * float risks the same drift a euro amount would. Scaled into whole
 * millilitres it is an ordinary integer column, consistent with the project's
 * standing no-floats rule.
 *
 * Deliberately its own tiny module rather than folded into `money.ts` - a
 * litre is not a currency, and a future refuelling module (Phase 2) that
 * needs "litres pumped" has no reason to import anything money-shaped to get
 * it.
 */

/** Up to one decimal - the precision the spreadsheet itself uses (`11,0`). */
export const LITERS_PATTERN = /^\d+([.,]\d)?$/;

export function isLitersAmount(value: string): boolean {
  return LITERS_PATTERN.test(value.trim());
}

/** Converts an already-validated litre string into whole millilitres. */
export function litersToMilliliters(value: string): number {
  const normalised = value.trim().replace(',', '.');
  return Math.round(Number(normalised) * 1_000);
}

export function millilitersToLiters(milliliters: number): number {
  return milliliters / 1_000;
}

/** The plain-number form for an editable input's `defaultValue` - `"11"` or `"11.5"`. */
export function millilitersToInputValue(milliliters: number): string {
  return String(millilitersToLiters(milliliters));
}

/**
 * `45,5 L` in the given `Intl` locale tag - pass `NUMBER_LOCALE`
 * (`src/lib/i18n/messages.ts`), mirroring `formatEuros`.
 */
export function formatLiters(milliliters: number, locale: string): string {
  const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    millilitersToLiters(milliliters),
  );
  return `${value} L`;
}
