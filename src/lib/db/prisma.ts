/**
 * The single Prisma client for the process (SRS 30.1).
 *
 * Two things this file exists to get right.
 *
 * **Connection reuse.** Next.js discards and re-evaluates modules on every hot
 * reload. Constructing a client at module scope without the `globalThis` cache
 * below opens a fresh connection pool on every file save, and PostgreSQL
 * starts refusing connections within a few minutes of work. In production the
 * module is evaluated once, so the cache is skipped.
 *
 * **Pool sizing.** Prisma 7 connects through a driver adapter, which means the
 * `pg` pool is ours to configure rather than something the engine hides. That
 * is the right default for the target deployment: SRS 4.4 puts this behind a
 * private subdomain on serverless hosting, where every warm instance holds its
 * own pool. A small `max` per instance is what keeps the total inside Neon's
 * connection ceiling.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { env } from '@/lib/env';

const globalForPrisma = globalThis as unknown as {
  bribarPrisma?: PrismaClient;
};

function createClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,

    // Deliberately low. A serverless deployment scales by adding instances,
    // not by widening one pool, so a large `max` here multiplies across every
    // warm instance and exhausts the database's connection limit instead of
    // improving throughput.
    max: env.NODE_ENV === 'production' ? 5 : 10,

    // Neon suspends idle compute; a socket held open past this is usually
    // already dead on the server side.
    idleTimeoutMillis: 30_000,

    // Fail fast rather than queueing a request behind an unreachable database
    // until the platform's own request timeout kills it.
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({
    adapter,

    // Query logging is far too noisy for a production log drain, and query
    // text can carry operational data that does not belong in a third-party
    // index (SRS 22.7).
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
  });
}

export const prisma: PrismaClient = globalForPrisma.bribarPrisma ?? createClient();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.bribarPrisma = prisma;
}

/**
 * The client handed to a `prisma.$transaction(...)` callback.
 *
 * Service-layer functions that perform a multi-table write - approving a
 * service writes the status, the history row and the audit entry (SRS 11.3) -
 * accept this type so they can be composed inside a caller's transaction
 * rather than opening a nested one.
 */
export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/** Either the pooled client or an open transaction; most repositories take this. */
export type PrismaClientLike = PrismaClient | PrismaTransactionClient;
