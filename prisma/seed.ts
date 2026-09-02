/**
 * Database bootstrap (SRS 31.2).
 *
 * "Initial Admin account must be created securely during deployment/bootstrap.
 *  Master data such as vehicles and routes may then be configured through the
 *  Admin Panel."
 *
 * Two behaviours follow from that sentence, and both matter:
 *
 *   * **The administrator is created in every environment**, from
 *     `SEED_ADMIN_PASSWORD`. There is no hard-coded fallback password: without
 *     the variable the script exits with instructions rather than creating an
 *     account whose credentials are in the repository.
 *
 *   * **Sample master data is created only outside production.** Demo drivers,
 *     vehicles and routes make local work and UAT possible, but seeding them
 *     into the client's live database would be a data-integrity problem the
 *     admin panel then has to clean up.
 *
 * The script is idempotent - every write is an upsert keyed on a natural
 * unique column - so re-running it after a schema change is safe and does not
 * duplicate anything.
 */
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';

import { ARGON2_OPTIONS } from '../src/lib/auth/password';
import { SERVICE_CODE_SEQUENCE } from '../src/modules/services/domain/service-code';

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

const isProduction = process.env['NODE_ENV'] === 'production';

async function seedAdministrator(): Promise<string> {
  const name = process.env['SEED_ADMIN_NAME'] ?? 'BRIBAR Administrator';
  const loginIdentifier = (process.env['SEED_ADMIN_LOGIN'] ?? 'admin').toLowerCase();
  const password = process.env['SEED_ADMIN_PASSWORD'];

  if (!password) {
    throw new Error(
      'SEED_ADMIN_PASSWORD is not set.\n\n' +
        'The bootstrap administrator has no default password by design - a\n' +
        'credential committed to source control is a credential leak (SRS 22.5).\n' +
        'Generate one and set it in the environment:\n\n' +
        '  SEED_ADMIN_PASSWORD="$(openssl rand -base64 24)" pnpm db:seed\n',
    );
  }

  const passwordHash = await hash(password, ARGON2_OPTIONS);

  // `update` deliberately omits `passwordHash`: re-seeding an existing
  // deployment must not silently reset a password the client has already
  // changed.
  const admin = await prisma.user.upsert({
    where: { loginIdentifier },
    create: { name, loginIdentifier, passwordHash, role: Role.ADMIN, isActive: true },
    update: { name, isActive: true },
  });

  console.log(`  administrator  ${loginIdentifier}`);
  return admin.id;
}

/** Demo master data. Never runs against production (see `main`). */
async function seedSampleData(): Promise<void> {
  const vehicles = await Promise.all(
    [
      { registrationPlate: '1234 ABC', referenceName: 'Volvo FH16 - Unidad 1' },
      { registrationPlate: '5678 DEF', referenceName: 'Scania R450 - Unidad 2' },
      { registrationPlate: '9012 GHI', referenceName: 'Remolque retirado', isActive: false },
    ].map((vehicle) =>
      prisma.vehicle.upsert({
        where: { registrationPlate: vehicle.registrationPlate },
        create: vehicle,
        update: vehicle,
      }),
    ),
  );

  const routes = await Promise.all(
    [
      {
        code: 'MAD-BCN-01',
        name: 'Madrid - Barcelona diario',
        origin: 'Centro logístico Madrid Sur',
        destination: 'Terminal Barcelona Zona Franca',
      },
      {
        code: 'MAD-VAL-02',
        name: 'Madrid - Valencia',
        origin: 'Centro logístico Madrid Sur',
        destination: 'Almacén Valencia Puerto',
      },
      {
        code: 'MAD-ZGZ-03',
        name: 'Madrid - Zaragoza lanzadera',
        origin: 'Centro logístico Madrid Sur',
        destination: 'Plataforma PLAZA Zaragoza',
      },
      {
        code: 'ANT-99',
        name: 'Contrato finalizado',
        origin: 'Nave Getafe',
        destination: 'Almacén Toledo',
        isActive: false,
      },
    ].map((route) =>
      prisma.route.upsert({ where: { code: route.code }, create: route, update: route }),
    ),
  );

  const demoPassword = process.env['SEED_DRIVER_PASSWORD'] ?? 'driver-local-dev-2026';
  const passwordHash = await hash(demoPassword, ARGON2_OPTIONS);

  // A driver configured exactly as SRS 9.2 expects: one default vehicle, one
  // default route, and additional assigned routes to choose from.
  const configuredDriver = await prisma.user.upsert({
    where: { loginIdentifier: 'conductor1' },
    create: {
      name: 'Ana García',
      loginIdentifier: 'conductor1',
      passwordHash,
      role: Role.DRIVER,
      isActive: true,
      defaultVehicleId: vehicles[0]?.id ?? null,
    },
    update: { defaultVehicleId: vehicles[0]?.id ?? null, isActive: true },
  });

  // A second driver with *no* configuration, so the "Admin configuration
  // required" path in SRS 24.2 has something to exercise during UAT.
  await prisma.user.upsert({
    where: { loginIdentifier: 'conductor2' },
    create: {
      name: 'Bruno Martín',
      loginIdentifier: 'conductor2',
      passwordHash,
      role: Role.DRIVER,
      isActive: true,
    },
    update: { isActive: true },
  });

  // Replace-then-write, so re-seeding cannot trip the partial unique index by
  // leaving a stale default behind.
  await prisma.driverRoute.deleteMany({ where: { driverId: configuredDriver.id } });
  await prisma.driverRoute.createMany({
    data: [
      { driverId: configuredDriver.id, routeId: routes[0]!.id, isDefault: true },
      { driverId: configuredDriver.id, routeId: routes[1]!.id, isDefault: false },
      { driverId: configuredDriver.id, routeId: routes[2]!.id, isDefault: false },
    ],
  });

  console.log(`  vehicles       ${vehicles.length} (1 inactive)`);
  console.log(`  routes         ${routes.length} (1 inactive)`);
  console.log('  drivers        conductor1 (configured), conductor2 (unconfigured)');
  console.log(`  driver login   conductor1 / ${demoPassword}`);
}

/**
 * Service IDs must continue the client's existing numbering
 * (`docs/open-questions.md` #2), and the migration cannot know where that
 * starts. A sequence still sitting at its initial value on a real deployment
 * means the application is about to re-issue IDs already printed on the
 * client's paperwork - worth a loud warning rather than a silent collision.
 */
async function warnIfServiceSequenceUnset(): Promise<void> {
  const [row] = await prisma.$queryRawUnsafe<{ last_value: bigint; is_called: boolean }[]>(
    `SELECT last_value, is_called FROM "${SERVICE_CODE_SEQUENCE}"`,
  );

  if (!row || row.is_called) return;

  console.warn(
    [
      '',
      '  WARNING  The Service ID sequence is still at its initial value.',
      '           Before go-live, continue the numbering from 01Servicios:',
      '',
      '             pnpm db:set-service-start <highest existing Service ID>',
      '',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  console.log(`Seeding BRIBAR Logistics (${isProduction ? 'production' : 'development'})`);

  await seedAdministrator();
  await warnIfServiceSequenceUnset();

  if (isProduction) {
    console.log('  sample data    skipped in production (SRS 31.2)');
    console.log('\nConfigure vehicles, routes and drivers through the Admin Panel.');
    return;
  }

  await seedSampleData();
  console.log('\nDone.');
}

main()
  .catch((error: unknown) => {
    console.error('\nSeed failed:\n');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
