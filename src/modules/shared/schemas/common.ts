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
import { TIME_OF_DAY_PATTERN, type TimeOfDay } from '@/lib/time/time-of-day';
import { MAX_ODOMETER_KM } from '@/modules/services/domain/mileage';

/** Record identifier. Always server-issued; never constructed by a client. */
export const uuidSchema = z.uuid({ error: VALIDATION.invalidReference });

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
