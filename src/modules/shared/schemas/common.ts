/**
 * Validation primitives shared by every module (SRS 25, 30.1).
 *
 * One definition per concept, imported by both the React form and the route
 * handler that receives it. SRS 25 tabulates each rule as "client-side" and
 * "server-side"; sharing the schema is how both columns stay true of the same
 * code rather than of two drifting copies.
 *
 * Messages come from `src/lib/i18n/messages.ts` — the interface is Spanish, and
 * a validation message is interface text like any other.
 *
 * Two conventions run through this file:
 *
 *   * **Strings are trimmed before validation.** A name of `"   "` is empty,
 *     not three characters long.
 *   * **Empty optional fields normalise to `undefined`.** SRS 9.4 requires a
 *     blank Sites or Observations not to block submission, and storing `""`
 *     next to `NULL` for "nothing entered" makes every later query ambiguous.
 */
import { z } from 'zod';

import { VALIDATION } from '@/lib/i18n/messages';
import { EUROS_PATTERN, eurosToCents } from '@/lib/money/money';
import { TIME_OF_DAY_PATTERN, type TimeOfDay } from '@/lib/time/time-of-day';
import { LITERS_PATTERN, litersToMilliliters } from '@/lib/units/fuel';
import { MAX_ODOMETER_KM } from '@/modules/services/domain/mileage';

/** Record identifier. Always server-issued; never constructed by a client. */
export const uuidSchema = z.uuid({ error: VALIDATION.invalidReference });

/**
 * An optional reference to another record — a `<select>` with a "none"
 * option submits `""`, which `z.uuid()` would otherwise reject as a
 * malformed id rather than treat as "nothing chosen" (ERP roadmap Phase 2's
 * optional fuel type / gas station / payment method on a refuel).
 */
export const optionalUuidSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}, uuidSchema.optional());

/**
 * A reference to another record that must stay explicitly clearable on
 * update — the same three-way signal as {@link moneySchema}: an absent key
 * leaves the stored value unchanged, a blank field is a deliberate "remove
 * the link" and parses to `null`, a value is validated as a reference. For a
 * field where `optionalUuidSchema`'s "blank means unchanged" would make it
 * impossible to ever unset once chosen (ERP roadmap Phase 4's
 * `Route.clientId` — a contract can end without a replacement client).
 */
export const clearableUuidSchema = z
  .preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }, uuidSchema.nullable())
  .optional();

/**
 * Turns a blank or whitespace-only string into `undefined` so `.optional()`
 * sees an absent value rather than an empty one.
 */
function emptyToUndefined(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** A required, trimmed text field. */
export function requiredText(label: string, maxLength: number, minLength = 1) {
  return z.preprocess(
    emptyToUndefined,
    z
      .string({ error: VALIDATION.required(label) })
      .min(minLength, VALIDATION.tooShort(label, minLength))
      .max(maxLength, VALIDATION.tooLong(label, maxLength)),
  );
}

/**
 * An optional, trimmed text field. Blank input becomes `undefined`.
 *
 * `maxLength` defaults to {@link FREE_TEXT_MAX_LENGTH}, which the client asked
 * to be effectively unlimited (`docs/open-questions.md` #8).
 */
export function optionalText(label: string, maxLength: number = FREE_TEXT_MAX_LENGTH) {
  return z.preprocess(
    emptyToUndefined,
    z.string().max(maxLength, VALIDATION.tooLong(label, maxLength)).optional(),
  );
}

/**
 * Ceiling on the free-text fields (Sites, Observations).
 *
 * The client asked for no limit, and the columns are `TEXT`, so there is no
 * storage reason for one. This is not a business rule — it is a guard against
 * an unauthenticated request posting a megabyte of text and making the database
 * pay for it. Ten thousand characters is roughly four pages: no driver will
 * reach it, and no attacker gets a cheap write amplifier.
 */
export const FREE_TEXT_MAX_LENGTH = 10_000;

/**
 * One odometer reading (SRS 10.3).
 *
 * Accepts a numeric string so an HTML number input works without the form layer
 * having to coerce, but rejects blank rather than coercing it to zero —
 * `Number("")` is `0`, and silently recording a missing reading as zero would
 * pass every ordering check while corrupting the data.
 *
 * This validates a reading in isolation. The relationships *between* the four
 * readings live in `validateMileage`, because they are domain rules rather than
 * field shapes.
 */
export const odometerKmSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : Number(trimmed);
  },
  z
    .number({ error: VALIDATION.invalidNumber })
    .int(VALIDATION.invalidNumber)
    .min(0, VALIDATION.invalidNumber)
    .max(MAX_ODOMETER_KM, VALIDATION.invalidNumber),
);

/**
 * A `HH:MM` clock reading (SRS 31.3).
 *
 * The output is branded `TimeOfDay`, so a parsed value can be handed straight
 * to `timeOfDayToDate` while an unvalidated string cannot.
 */
export const timeOfDaySchema = z.preprocess(
  emptyToUndefined,
  z
    .string({ error: VALIDATION.invalidTime })
    .regex(TIME_OF_DAY_PATTERN, VALIDATION.invalidTime)
    .transform((value) => value as TimeOfDay),
);

/**
 * An admin-only euro amount (route default rate, service rate — ERP roadmap
 * Phase 0). Output is whole cents.
 *
 * Three distinct signals, not two: an **absent** key leaves the stored value
 * unchanged (a true partial update); a **blank** field is a deliberate "clear
 * the rate" and parses to `null`; a valid amount parses to cents. Collapsing
 * blank into "absent" — `optionalText`'s behaviour — would make it impossible
 * for an administrator to remove a rate once one is set, since every form
 * re-submits every field whether or not it changed.
 */
export const moneySchema = z
  .preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }, z.string().regex(EUROS_PATTERN, VALIDATION.invalidMoney).transform(eurosToCents).nullable())
  .optional();

/**
 * A required euro amount — never absent, never nullable, unlike
 * {@link moneySchema}. For a field that always has a value once the record
 * exists (a refuel's total price, the config screen's default fuel price),
 * where there is no "clear it" state to represent.
 */
export const requiredMoneySchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}, z.string({ error: VALIDATION.invalidMoney }).regex(EUROS_PATTERN, VALIDATION.invalidMoney).transform(eurosToCents));

/**
 * A required litre amount (ERP roadmap Phase 1's config screen, Phase 2's
 * refuelling module). Same required/non-nullable shape as
 * {@link requiredMoneySchema}, for the same reason.
 */
export const litersSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}, z.string({ error: VALIDATION.invalidLiters }).regex(LITERS_PATTERN, VALIDATION.invalidLiters).transform(litersToMilliliters));

/**
 * The five VAT rates (`prisma/schema.prisma`'s `VatRate` enum / `vat.ts`'s
 * `VatRate` union) as a schema — shared by every module that lets an
 * administrator pick one (refuelling, expense categories, received
 * invoices), so there is one place the five string literals are spelled out.
 */
export const VAT_RATES = ['STANDARD', 'REDUCED', 'SUPER_REDUCED', 'ZERO', 'EXEMPT'] as const;

export const vatRateSchema = z.enum(VAT_RATES, { error: VALIDATION.invalidVatRate });

/** A `yyyy-MM-dd` calendar day, for admin date filters (SRS 16.3). */
export const isoDateSchema = z.preprocess(emptyToUndefined, z.iso.date(VALIDATION.invalidDate));

/** Active/inactive toggle, tolerant of the `"true"` a query string carries. */
export const booleanSchema = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

/**
 * Page-based list controls (SRS 23.8).
 *
 * `pageSize` is capped so a crafted `?pageSize=100000` cannot be used to pull
 * the whole services table in one request.
 */
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  q: z.string().optional(),
  status: z.string().optional(),
  sort: z.string().optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  role: z.string().optional(),
  isActive: z.preprocess((value) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  }, z.boolean().optional()),
});

export type Pagination = z.output<typeof paginationSchema>;

/** Translates a validated page/pageSize pair into Prisma's `skip`/`take`. */
export function toPrismaPagination({ page, pageSize }: Pagination): {
  skip: number;
  take: number;
} {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
