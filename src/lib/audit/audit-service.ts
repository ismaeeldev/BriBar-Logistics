/**
 * Audit trail (SRS 19.9, 21, 22.7).
 *
 * SRS 21.1 requires creation, edits and approvals to be attributable to a user
 * and a timestamp. The `services` table carries some of that directly —
 * `created_at`, `approved_by_user_id` — but it only ever holds the *current*
 * state. "Who changed the mileage on service 1247, and what was it before?" is
 * a question only an append-only log can answer, and SRS 21.3 asks it
 * explicitly of administrator edits after approval.
 *
 * ## Two rules govern every write here
 *
 * **Audit writes join the caller's transaction.** Every function takes a client
 * rather than reaching for the global one, so an approval and its audit row
 * commit or roll back together. An audit trail that can disagree with the data
 * it describes is worse than none, because it is trusted.
 *
 * **Secrets never reach the JSON columns.** SRS 19.9 says so of password
 * hashes, and 22.7 of credentials generally. `redactAuditPayload` enforces it
 * on the way in rather than relying on every call site to remember, because a
 * leak here is permanent: the row is append-only and the log is exactly what
 * someone will later be given read access to.
 */
import { AuditAction, AuditEntityType, type Prisma } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export { AuditAction, AuditEntityType };

/**
 * Field names that must never be written to `before_data` or `after_data`.
 *
 * Matched against the normalised key, so `passwordHash`, `password_hash` and
 * `PASSWORD_HASH` all hit the same entry.
 */
const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'newpassword',
  'currentpassword',
  'secret',
  'token',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'apikey',
]);

const REDACTION = '[redacted]';

function normaliseKey(key: string): string {
  return key.replace(/[-_\s]/g, '').toLowerCase();
}

/**
 * Strips secrets and converts values into something `JSONB` can hold.
 *
 * `Date` becomes an ISO string and `bigint` a decimal string, because
 * `JSON.stringify` throws on the latter and renders the former inconsistently
 * depending on how it is reached.
 */
export function redactAuditPayload(value: unknown): Prisma.InputJsonValue | null {
  function walk(input: unknown, depth: number): unknown {
    if (depth > 8) return '[max depth]';
    if (input === null || input === undefined) return null;
    if (input instanceof Date) return input.toISOString();
    if (typeof input === 'bigint') return input.toString();
    if (typeof input !== 'object') return input;
    if (Array.isArray(input)) return input.map((item) => walk(item, depth + 1));

    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(input as Record<string, unknown>)) {
      out[key] = REDACTED_KEYS.has(normaliseKey(key)) ? REDACTION : walk(item, depth + 1);
    }
    return out;
  }

  const result = walk(value, 0);
  return result === null ? null : (result as Prisma.InputJsonValue);
}

export interface AuditEntry {
  /** Who performed the action. Null only for system actions such as seeding. */
  actorUserId: string | null;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  /** Relevant previous values. Omit for a creation. */
  before?: unknown;
  /** Relevant resulting values. Omit for a pure state read. */
  after?: unknown;
}

/**
 * Writes one audit row inside the caller's transaction.
 *
 * Does not catch its own errors. If the audit write fails, the operation it
 * describes must fail with it — SRS 21 treats traceability as part of the
 * record, not as telemetry that may be dropped when convenient.
 */
export async function writeAudit(client: PrismaClientLike, entry: AuditEntry): Promise<void> {
  const before = entry.before === undefined ? null : redactAuditPayload(entry.before);
  const after = entry.after === undefined ? null : redactAuditPayload(entry.after);

  await client.auditLog.create({
    data: {
      actorUserId: entry.actorUserId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      ...(before !== null ? { beforeData: before } : {}),
      ...(after !== null ? { afterData: after } : {}),
    },
  });

  logger.info('Audit entry written', {
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    actorUserId: entry.actorUserId,
  });
}

/**
 * The subset of an object whose values changed.
 *
 * Storing whole rows in `before_data` makes a diff unreadable — every field
 * looks changed and the reviewer has to compare by eye. This narrows both sides
 * to the fields that actually moved, which is what makes SRS 21.3's
 * "administrator edits after approval are audited" useful rather than merely
 * true.
 *
 * Returns `null` when nothing changed, so a no-op update writes no audit row.
 */
export function diffForAudit<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): { before: Partial<T>; after: Partial<T> } | null {
  const changedBefore: Partial<T> = {};
  const changedAfter: Partial<T> = {};
  let changed = false;

  for (const key of Object.keys(after) as (keyof T)[]) {
    const previous = before[key];
    const next = after[key];

    // Dates compare by identity, so normalise before deciding.
    const previousValue = previous instanceof Date ? previous.getTime() : previous;
    const nextValue = next instanceof Date ? next.getTime() : next;

    if (previousValue === nextValue) continue;

    changedBefore[key] = previous;
    changedAfter[key] = next as T[keyof T];
    changed = true;
  }

  return changed ? { before: changedBefore, after: changedAfter } : null;
}
