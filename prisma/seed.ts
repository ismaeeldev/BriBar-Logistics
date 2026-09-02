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
      { registrationPlate: 'AA-01-BB', referenceName: 'Volvo FH16 - Unit 1' },
      { registrationPlate: 'CC-02-DD', referenceName: 'Scania R450 - Unit 2' },
      { registrationPlate: 'EE-03-FF', referenceName: 'Retired trailer unit', isActive: false },
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
        code: 'LIS-PRT-01',
        name: 'Lisboa - Porto Daily',
        origin: 'Lisboa Distribution Centre',
        destination: 'Porto Terminal North',
      },
      {
        code: 'LIS-FAR-02',
        name: 'Lisboa - Faro Southbound',
        origin: 'Lisboa Distribution Centre',
        destination: 'Faro Regional Depot',
      },
      {
        code: 'PRT-BRG-03',
        name: 'Porto - Braga Shuttle',
        origin: 'Porto Terminal North',
        destination: 'Braga Client Site',
      },
      {
        code: 'OLD-ROUTE-99',
        name: 'Discontinued contract',
        origin: 'Setubal Yard',
        destination: 'Evora Warehouse',
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
    where: { loginIdentifier: 'driver1' },
    create: {
      name: 'Ana Ferreira',
      loginIdentifier: 'driver1',
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
    where: { loginIdentifier: 'driver2' },
    create: {
      name: 'Bruno Costa',
      loginIdentifier: 'driver2',
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
  console.log('  drivers        driver1 (configured), driver2 (unconfigured)');
  console.log(`  driver1 login  driver1 / ${demoPassword}`);
}

async function main(): Promise<void> {
  console.log(`Seeding BRIBAR Logistics (${isProduction ? 'production' : 'development'})`);

  await seedAdministrator();

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
