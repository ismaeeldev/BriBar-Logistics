/**
 * Advances the Service ID sequence to continue the client's existing numbering.
 *
 * The new system must carry on from the last number used in the client's
 * "01Servicios" register (`docs/open-questions.md` #2). Until this runs, the
 * sequence starts at 1 and the application would re-issue Service IDs that
 * already appear on the client's paperwork.
 *
 * Run once, against the production database, before go-live:
 *
 *     pnpm db:set-service-start 1247
 *
 * where 1247 is the highest Service ID currently in 01Servicios. The next
 * service created will be 1248.
 *
 * Two safety properties, both deliberate:
 *
 *   * It refuses to move the sequence backwards. Running it twice, or with a
 *     stale number, cannot cause re-issued IDs.
 *   * It refuses to run if the `services` table already holds a higher code,
 *     which would mean the system has been in real use past that number.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { SERVICE_CODE_SEQUENCE } from '../src/modules/services/domain/service-code';

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

function parseArgument(): number {
  const raw = process.argv[2];

  if (!raw) {
    throw new Error(
      'Usage: pnpm db:set-service-start <highest existing Service ID>\n\n' +
        "Pass the largest number already used in the client's 01Servicios register.\n" +
        'The next service created will be that number plus one.',
    );
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`"${raw}" is not a positive whole number.`);
  }

  return value;
}

async function main(): Promise<void> {
  const target = parseArgument();

  const rows = await prisma.$queryRawUnsafe<{ last_value: bigint }[]>(
    `SELECT last_value FROM "${SERVICE_CODE_SEQUENCE}"`,
  );
  const current = rows[0]?.last_value;

  if (current === undefined) {
    throw new Error(
      `Sequence "${SERVICE_CODE_SEQUENCE}" does not exist. Run migrations first.`,
    );
  }

  if (BigInt(target) < current) {
    throw new Error(
      `The sequence is already at ${current}. Refusing to move it back to ${target}, ` +
        'which would re-issue Service IDs that have already been allocated.',
    );
  }

  // A service already numbered above the target means the system has been in
  // real use past that point, and the client's register is not the authority
  // any more.
  const highest = await prisma.$queryRawUnsafe<{ max: number | null }[]>(
    `SELECT MAX(service_code::bigint) AS max FROM services WHERE service_code ~ '^[0-9]+$'`,
  );
  const highestExisting = highest[0]?.max ?? null;

  if (highestExisting !== null && highestExisting > target) {
    throw new Error(
      `The services table already contains Service ID ${highestExisting}, which is higher ` +
        `than ${target}. Refusing to continue.`,
    );
  }

  await prisma.$executeRawUnsafe(`SELECT setval('${SERVICE_CODE_SEQUENCE}', ${target})`);

  console.log(`Service ID sequence set to ${target}.`);
  console.log(`The next service created will be ${target + 1}.`);
}

main()
  .catch((error: unknown) => {
    console.error('\n' + (error instanceof Error ? error.message : String(error)) + '\n');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
