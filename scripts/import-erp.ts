/**
 * One-time ERP data import (roadmap Phase 7).
 *
 *     pnpm erp:import path/to/bundle.json            # dry run — writes nothing
 *     pnpm erp:import path/to/bundle.json --commit   # writes, in one pass
 *
 * The bundle is JSON: one key per source sheet, each an array of row objects
 * whose fields already use the app's conventions (ISO `yyyy-MM-dd` dates,
 * euro amounts as plain strings like "1234.56", references to master data by
 * name). `docs/erp-cutover-runbook.md` documents how to produce it from the
 * `.xlsm`.
 *
 * Dry-run first, always. The importer refuses to commit a bundle with any row
 * in error, and every write is idempotent on a natural key, so a re-run after
 * fixing the source — or after an interrupted commit — is safe.
 */
import { readFile } from 'node:fs/promises';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set. Load the target environment first.');

const [, , bundlePathArg, ...flags] = process.argv;
const commit = flags.includes('--commit');

if (!bundlePathArg) {
  console.error('Usage: pnpm erp:import <bundle.json> [--commit]');
  process.exit(2);
}
const bundlePath: string = bundlePathArg;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

async function main(): Promise<void> {
  const raw = await readFile(bundlePath, 'utf8');
  const bundle = JSON.parse(raw) as Record<string, unknown>;

  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true, name: true },
  });
  if (!admin) {
    throw new Error(
      'No active administrator to attribute the import to. Run `pnpm db:seed` first.',
    );
  }
  const actor = { userId: admin.id, name: admin.name, role: 'ADMIN' as const };

  // Imported dynamically so this script's `PrismaClient` is the one in use
  // (the module singleton reads the same DATABASE_URL).
  const { migrationService } = await import('../src/modules/migration/service/migration.service');
  const { formatReport } = await import('../src/modules/migration/domain/import-report');

  const result = await migrationService.run(actor, bundle, { commit });

  console.log(formatReport(result.plan, { committed: result.committed }));

  if (result.config.errors.length > 0) {
    console.log('\nconfig sheet:');
    for (const error of result.config.errors) console.log(`  ${error}`);
  } else if (result.config.applied) {
    console.log('\nconfig sheet: operational defaults updated.');
  }

  const summary = result.plan.entities.flatMap((entity) => entity.rows);
  const errored = summary.filter((row) => row.outcome === 'error').length;
  if (errored > 0) process.exitCode = 1;
  else if (!commit) console.log('\nDry run only. Add --commit to write.');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
