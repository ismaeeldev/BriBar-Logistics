/**
 * One-off snapshot export (roadmap Phase 7, §3.6).
 *
 *     pnpm erp:snapshot ./snapshot-2026-09
 *
 * Writes one CSV per table into the given directory — every table opens
 * directly in Excel. This is the "audit safety net" the roadmap describes for
 * the first months after cutover, not a sync: it is a point-in-time dump, run
 * by hand when someone wants one. A true multi-sheet `.xlsx` in the original
 * layout would need a spreadsheet-writer dependency the project has so far
 * done without; CSVs cover the purpose.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { toCsv } from '../src/lib/csv/csv';

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set. Load the target environment first.');

const [, , outDirArg] = process.argv;
if (!outDirArg) {
  console.error('Usage: pnpm erp:snapshot <output-directory>');
  process.exit(2);
}
const outDir: string = outDirArg;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

async function dump(name: string, rows: Record<string, unknown>[]): Promise<void> {
  await writeFile(join(outDir, `${name}.csv`), toCsv(rows), 'utf8');
  console.log(`  ${name}.csv — ${rows.length} row(s)`);
}

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  console.log(`Snapshot → ${outDir}`);

  await dump('vehicles', await prisma.vehicle.findMany());
  await dump('routes', await prisma.route.findMany());
  await dump('clients', await prisma.client.findMany());
  await dump('suppliers', await prisma.supplier.findMany());
  await dump('expense_categories', await prisma.expenseCategory.findMany());
  await dump('lookup_items', await prisma.lookupItem.findMany());
  await dump('users', await prisma.user.findMany({
    select: { id: true, name: true, loginIdentifier: true, role: true, isActive: true },
  }));
  await dump('services', await prisma.service.findMany());
  await dump('refuellings', await prisma.refuelling.findMany());
  await dump('received_invoices', await prisma.receivedInvoice.findMany());
  await dump('issued_invoices', await prisma.issuedInvoice.findMany());
  await dump('personnel_costs', await prisma.personnelCost.findMany());
  await dump('daily_km_logs', await prisma.dailyKmLog.findMany());
  await dump('maintenance_records', await prisma.maintenanceRecord.findMany());
  await dump('app_config', [await prisma.appConfig.findFirstOrThrow()]);

  console.log('Done.');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
