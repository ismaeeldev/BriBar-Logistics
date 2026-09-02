/**
 * The human-visible Service ID (SRS 9.2, 19.1, 19.7).
 *
 * Two identifiers exist for a reason. The primary key is a UUID the database
 * cares about; the Service ID is what a driver reads back over the phone and
 * what an administrator searches for. SRS 19.1 requires them to be separate, so
 * the code below never encodes the UUID.
 *
 * ## Format
 *
 * A plain decimal number: `1`, `2`, `3`, … `1247`.
 *
 * The client's existing register ("01Servicios") numbers services sequentially,
 * and the new system must continue that series rather than start its own
 * (`docs/open-questions.md` #2). No prefix, no date segment, no zero padding —
 * anything added here would break continuity with records the business already
 * treats as authoritative.
 *
 * ## Where the number comes from
 *
 * `nextval('service_code_seq')`, a dedicated PostgreSQL sequence.
 *
 * SRS 23.4 requires concurrent submissions never to collide and SRS 26.6 tests
 * it. Reading `MAX(service_code)` and adding one has a race between the read
 * and the insert; under two drivers submitting together it yields either a
 * duplicate or a failed submission. `nextval()` is atomic, never blocks, and is
 * deliberately not rolled back by a failed transaction, so two drivers
 * submitting in the same millisecond are guaranteed different numbers.
 *
 * The cost of that guarantee is gaps: a submission that fails after allocating
 * a number leaves it unused. Gaps are cosmetic; collisions are data loss. The
 * `UNIQUE` constraint on `services.service_code` remains as a backstop.
 *
 * ## Continuing the existing series
 *
 * The sequence starts at 1. Before go-live it must be advanced past the highest
 * number already used in 01Servicios, or the new system will re-issue IDs the
 * client has already printed on paperwork:
 *
 *     SELECT setval('service_code_seq', <highest existing number>);
 *
 * `scripts/set-service-code-start.ts` does this and refuses to move the
 * sequence backwards. See the deployment section of the README.
 */

/**
 * Renders an allocated sequence value as a Service ID.
 *
 * Trivial today, and kept as a named function anyway: it is the single place
 * the format is defined, so a future prefix or padding requirement is one edit
 * with one set of tests rather than a search for string concatenation.
 *
 * @param sequence A value from `nextval('service_code_seq')`. `bigint` because
 *                 that is what PostgreSQL returns for a `BIGINT` sequence.
 */
export function formatServiceCode(sequence: number | bigint): string {
  return String(sequence);
}

/**
 * Whether a string looks like a Service ID.
 *
 * Used by admin search to tell an ID apart from free text. Rejects leading
 * zeroes so `007` is treated as a search term rather than as service 7.
 */
export const SERVICE_CODE_PATTERN = /^[1-9]\d*$/;

export function isServiceCode(value: string): boolean {
  return SERVICE_CODE_PATTERN.test(value);
}

/** The PostgreSQL sequence created by the initial migration. */
export const SERVICE_CODE_SEQUENCE = 'service_code_seq';
