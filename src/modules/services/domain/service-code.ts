/**
 * The human-visible Service ID (SRS 9.2, 19.1, 19.7).
 *
 * Two identifiers exist for a reason. The primary key is a UUID the database
 * cares about; the Service ID is what a driver reads back over the phone and
 * what an administrator searches for. SRS 19.1 requires them to be separate,
 * so the code below never encodes the UUID.
 *
 * Format: `SRV-20260902-000042`
 *
 *   prefix    SERVICE_CODE_PREFIX, configurable per deployment.
 *   date      the service's business date in APP_TIMEZONE - the segment that
 *             makes a code meaningful when read aloud.
 *   sequence  the next value of the PostgreSQL sequence `service_code_seq`.
 *
 * Uniqueness comes from the sequence alone, not from the date. This matters:
 * SRS 23.4 requires concurrent submissions never to collide, and a per-day
 * counter cannot deliver that without either a lock or a read-modify-write
 * race across the midnight boundary. `nextval()` is atomic, never blocks, and
 * is not rolled back by a failed transaction - so two drivers submitting in
 * the same millisecond are guaranteed different numbers.
 *
 * The trade-off is that a rolled-back submission burns a number, leaving gaps
 * in the sequence. That is the correct trade: gaps are cosmetic, collisions
 * are data loss. The `UNIQUE` constraint on `services.service_code` remains as
 * a backstop.
 */
import { toIsoDate } from '@/lib/time/business-date';

/** Zero-padding width. Six digits allows 999,999 services before it widens. */
const SEQUENCE_WIDTH = 6;

/**
 * Assembles a Service ID from its parts.
 *
 * Pure, so it can be unit-tested without a database (SRS 30.1). Allocating the
 * sequence value is the repository's job.
 *
 * @param prefix       `env.SERVICE_CODE_PREFIX`, already validated upstream.
 * @param businessDate The service's business date (`@db.Date`, UTC midnight).
 * @param sequence     A value from `nextval('service_code_seq')`.
 */
export function formatServiceCode(
  prefix: string,
  businessDate: Date,
  sequence: number | bigint,
): string {
  const datePart = toIsoDate(businessDate).replaceAll('-', '');
  const sequencePart = String(sequence).padStart(SEQUENCE_WIDTH, '0');
  return `${prefix}-${datePart}-${sequencePart}`;
}

/**
 * Matches any code this module can produce.
 *
 * Deliberately permissive about the sequence width so codes issued before a
 * future widening still validate. Used by admin search to tell a Service ID
 * apart from a free-text query.
 */
export const SERVICE_CODE_PATTERN = /^[A-Z][A-Z0-9]{1,7}-\d{8}-\d{4,}$/;

export function isServiceCode(value: string): boolean {
  return SERVICE_CODE_PATTERN.test(value);
}

/** The name of the PostgreSQL sequence created by the initial migration. */
export const SERVICE_CODE_SEQUENCE = 'service_code_seq';
