/**
 * Money as integer cents (SRS-scope: EUR only).
 *
 * Never a float. Floats and money don't mix - the classic `0.1 + 0.2` problem -
 * and the client's own spreadsheet already shows the symptom: a chain of
 * `=Total/1.21` divisions carrying sixteen decimal places
 * (`docs/erp-migration/README.md` §2). Every euro amount that reaches a
 * database column reaches it as a whole number of cents; this module is the
 * one place euros and cents convert, and every later financial module (VAT,
 * invoices, personnel costs, fuel prices) is meant to reuse it rather than
 * inventing its own.
 *
 * Mirrors `src/lib/time/time-of-day.ts`: a pattern, pure mappers, and nothing
 * that knows about Zod, Prisma or React. Request payloads go through
 * `moneySchema` (`modules/shared/schemas/common.ts`), which reports a bad
 * amount as a field error rather than this module throwing.
 */

/**
 * Up to two decimals, either separator. A Spanish keyboard types a comma; an
 * HTML number input and a pasted value both use a dot. Rejects a leading sign
 * on purpose - "no rate" is `null`, not a negative one.
 */
export const EUROS_PATTERN = /^\d+([.,]\d{1,2})?$/;

export function isEurosAmount(value: string): boolean {
  return EUROS_PATTERN.test(value.trim());
}

/**
 * Converts an already-validated euro string into whole cents.
 *
 * Rounds rather than truncates, so a value with more precision than the regex
 * allows (there shouldn't be one, once `isEurosAmount` has run) still lands on
 * the nearest cent instead of being silently shaved down.
 */
export function eurosToCents(value: string): number {
  const normalised = value.trim().replace(',', '.');
  return Math.round(Number(normalised) * 100);
}

export function centsToEuros(cents: number): number {
  return cents / 100;
}

/**
 * `1.234,56 €` in the given `Intl` locale tag - pass `NUMBER_LOCALE`
 * (`src/lib/i18n/messages.ts`) for the grouping/decimal convention the rest of
 * the interface already uses.
 */
export function formatEuros(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(
    centsToEuros(cents),
  );
}

/**
 * The plain-number form for an editable input's `defaultValue` - `"180"` or
 * `"180.5"`, not currency-formatted and not comma-separated, so re-parsing it
 * (by `EUROS_PATTERN`, or by the user retyping over it) is unambiguous.
 */
export function centsToInputValue(cents: number): string {
  return String(centsToEuros(cents));
}
