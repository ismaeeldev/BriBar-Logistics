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

import { REFUELLING_CODE_SEQUENCE } from '@/modules/refuelling/repository/refuelling.repository';
import { RECEIVED_INVOICE_CODE_SEQUENCE } from '@/modules/received-invoices/repository/received-invoice.repository';
import { MAINTENANCE_CODE_SEQUENCE } from '@/modules/maintenance/repository/maintenance-record.repository';
import { SERVICE_CODE_SEQUENCE } from '@/modules/services/domain/service-code';

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
  'notifications',
  'service_status_history',
  'services',
  'driver_routes',
  // ERP roadmap Phase 2: references vehicles, users and lookup_items, so it
  // must be truncated before all three.
  'refuellings',
  // ERP roadmap Phase 3: references suppliers, expense_categories, vehicles
  // and lookup_items, so it must be truncated before all four.
  'received_invoices',
  // ERP roadmap Phase 4: references clients and lookup_items; `services`
  // (already listed above) references this table in turn, via
  // `issued_invoice_id`.
  'issued_invoices',
  // ERP roadmap Phase 5: references vehicles, routes, users and lookup_items
  // (maintenance_records -> lookup_items), so all three must be truncated
  // before them.
  'daily_km_logs',
  'personnel_costs',
  'maintenance_records',
  'users',
  'routes',
  'vehicles',
  // ERP roadmap Phase 1. No FK relations to worry about in the ordering.
  'clients',
  // Client change request 2026-09-17: `routes.end_client_id` references this,
  // so it must be truncated after `routes`, same as `clients`.
  'end_clients',
  'lookup_items',
  // ERP roadmap Phase 3. Same reasoning.
  'suppliers',
  'expense_categories',
] as const;

/** `app_config` is a singleton (see the model's doc comment) — truncated and
 * reseeded on its own rather than joining `TABLES`, so every test starts from
 * the same known defaults instead of whatever an earlier test's `update()`
 * left behind. */
const APP_CONFIG_DEFAULTS = {
  oilChangeIntervalKm: 15_000,
  defaultConsumptionMlPer100Km: 11_000,
  defaultFuelPriceCentsPerLiter: 152,
};

beforeEach(async () => {
  // One statement so it is a single transaction.
  await testPrisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );

  // `RESTART IDENTITY` only resets sequences *owned* by a truncated table's
  // identity or serial column. `service_code_seq` is standalone - deliberately
  // so, because its value must survive a rolled-back insert (SRS 23.4) - and
  // therefore has to be reset by hand. Without this, Service IDs would carry
  // over between test files and any assertion about a specific number would
  // depend on execution order.
  await testPrisma.$executeRawUnsafe(
    `ALTER SEQUENCE "${SERVICE_CODE_SEQUENCE}" RESTART WITH 1`,
  );

  // ERP roadmap Phase 2/3: the same standalone-sequence reasoning applies to
  // `refuelling_code_seq` and `received_invoice_code_seq`.
  await testPrisma.$executeRawUnsafe(
    `ALTER SEQUENCE "${REFUELLING_CODE_SEQUENCE}" RESTART WITH 1`,
  );
  await testPrisma.$executeRawUnsafe(
    `ALTER SEQUENCE "${RECEIVED_INVOICE_CODE_SEQUENCE}" RESTART WITH 1`,
  );
  // ERP roadmap Phase 5: same standalone-sequence reasoning for `maintenance_code_seq`.
  await testPrisma.$executeRawUnsafe(
    `ALTER SEQUENCE "${MAINTENANCE_CODE_SEQUENCE}" RESTART WITH 1`,
  );

  await testPrisma.appConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...APP_CONFIG_DEFAULTS },
    update: APP_CONFIG_DEFAULTS,
  });
});

afterAll(async () => {
  await testPrisma.$disconnect();
});
