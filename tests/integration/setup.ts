/**
 * Integration-test harness.
 *
 * Runs against a real PostgreSQL instance because that is the only way to test
 * what these tests are about: CHECK constraints, a partial unique index, and
 * how Prisma maps a `time` column. None of it can be verified against a mock.
 *
 * `pnpm test:integration` applies `.env.test` first, which points at the
 * `bribar_test` database. The guard below refuses to run if that has not
 * happened - truncating the development database mid-session is not a mistake
 * worth being able to make.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach } from 'vitest';

const DATABASE_URL = process.env['DATABASE_URL'];

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Run the integration suite with `pnpm test:integration`, ' +
      'which loads .env.test.',
  );
}

if (
  !/_test(\?|$)/.test(new URL(DATABASE_URL).pathname + (new URL(DATABASE_URL).search || ''))
) {
  throw new Error(
    `Refusing to run integration tests against "${new URL(DATABASE_URL).pathname.slice(1)}". ` +
      'The database name must end in `_test`, because this suite truncates every table.',
  );
}

export const testPrisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

/**
 * Tables in dependency order, child first.
 *
 * `TRUNCATE ... CASCADE` would handle the ordering itself, but naming the
 * tables explicitly means adding a table to the schema and forgetting it here
 * shows up as a failing test rather than as data leaking between test files.
 */
const TABLES = [
  'audit_logs',
  'service_status_history',
  'services',
  'driver_routes',
  'users',
  'routes',
  'vehicles',
] as const;

beforeEach(async () => {
  // One statement so it is a single transaction; RESTART IDENTITY resets
  // service_code_seq, keeping generated Service IDs predictable per test.
  await testPrisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await testPrisma.$disconnect();
});
