/**
 * The human-visible document number, generalised (ERP roadmap Phase 1,
 * roadmap §3.3).
 *
 * `src/modules/services/domain/service-code.ts` already solved this once for
 * services: a plain decimal number allocated from a PostgreSQL sequence, kept
 * distinct from the primary key so concurrent submissions never collide (ADR
 * 0003). The spreadsheet has five more series of the same shape — `S000140`
 * (services, already running), `R000046` (refuelling), `FR000090` (received
 * invoices), `FE000003` (issued invoices), `MT000005` (maintenance), `T-00003`
 * (taxes) — each a prefix plus a zero-padded counter.
 *
 * This file is only the formatting half. The other half of ADR 0003's
 * pattern — `CREATE SEQUENCE …_seq`, a `pnpm db:set-sequence <type> <n>`
 * migration step to continue the spreadsheet's own numbering, `nextval()`
 * called inside the module's `create()` — is created by whichever phase first
 * needs a given series (Phase 2 for `R`, Phase 3 for `FR`, Phase 4 for `FE`,
 * Phase 5 for `MT`), not here: a sequence with nothing writing to it yet is
 * dead schema, and the format alone is enough to unblock every module that
 * only needs to *render* a code it has already been given.
 */

/**
 * Renders an allocated sequence value as the client's document format:
 * a prefix, then the value zero-padded to `width` digits.
 *
 * `formatServiceCode` deliberately used no prefix and no padding, because
 * SRS 19.1 required continuing "01Servicios"'s bare-number series exactly.
 * The other five series do not carry that requirement — this is their
 * format, kept separate from `formatServiceCode` rather than replacing it.
 *
 * @param prefix e.g. `'R'`, `'FR'`, `'FE'`, `'MT'`, `'T-'`.
 * @param width  total digit count, e.g. `6` for `R000046`, `5` for `T-00003`.
 * @param sequence A value from `nextval('<type>_seq')`. `bigint` because that
 *                 is what PostgreSQL returns for a `BIGINT` sequence.
 */
export function formatDocumentCode(
  prefix: string,
  width: number,
  sequence: number | bigint,
): string {
  return `${prefix}${String(sequence).padStart(width, '0')}`;
}
