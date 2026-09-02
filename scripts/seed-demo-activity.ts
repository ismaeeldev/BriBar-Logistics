/**
 * Fills the last two weeks with plausible services, for demos and UAT.
 *
 *     pnpm db:demo
 *
 * The dashboards summarise a fortnight, and a fortnight containing two services
 * tells you nothing about whether the summary works — an empty chart looks the
 * same whether it is correct or broken. This generates enough shaped activity
 * to see the trend, the route ranking and a realistic mix of statuses.
 *
 * Refuses to run against production. It writes records that look real and are
 * not, and the one database that must never contain those is the client's.
 *
 * Deliberately separate from `pnpm db:seed`: that bootstraps an administrator
 * and the master data an empty deployment needs (SRS 31.2). This invents
 * operational history, which is a different thing and must never be automatic.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');

if (process.env['NODE_ENV'] === 'production') {
  throw new Error(
    'Refusing to write demo services to a production database.\n' +
      'This script invents operational history; run it only against development or UAT.',
  );
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

const DAYS = 14;

/** A `@db.Time` value: a clock reading, pinned to the epoch in UTC. */
const time = (hours: number, minutes: number) =>
  new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));

async function main(): Promise<void> {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  const vehicles = await prisma.vehicle.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  const assignments = (
    await prisma.driverRoute.findMany({
      include: {
        route: { select: { id: true, origin: true, destination: true, isActive: true } },
      },
    })
  ).filter((assignment) => assignment.route.isActive);

  if (!admin || vehicles.length === 0 || assignments.length === 0) {
    throw new Error(
      'Run `pnpm db:seed` first — this needs an administrator, an active vehicle and an assigned route.',
    );
  }

  // One running odometer across every generated service, so readings climb the
  // way a real fleet's would rather than jumping around.
  let odometer = 40_000;
  let created = 0;

  for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - daysAgo);

    // Quiet Sundays, light Saturdays, busy weekdays — the trend then has the
    // shape a real week has, and a flat chart would look obviously wrong.
    const weekday = day.getUTCDay();
    const count = weekday === 0 ? 0 : weekday === 6 ? 1 : 2 + (daysAgo % 3);

    for (let index = 0; index < count; index++) {
      const assignment = assignments[(daysAgo + index) % assignments.length]!;
      const vehicle = vehicles[(daysAgo + index) % vehicles.length]!;

      const approach = 10 + ((daysAgo * 7 + index * 13) % 40);
      const contracted = 60 + ((daysAgo * 23 + index * 37) % 380);
      const back = 8 + ((daysAgo * 11 + index * 5) % 35);

      const startDashboardKm = odometer;
      const startBaseKm = startDashboardKm + approach;
      const endBaseKm = startBaseKm + contracted;
      const endDashboardKm = endBaseKm + back;
      odometer = endDashboardKm + 5;

      // The same sequence the application uses, so demo records never collide
      // with real ones and the numbering stays continuous (SRS 19.1).
      const rows = await prisma.$queryRawUnsafe<{ value: bigint }[]>(
        `SELECT nextval('service_code_seq') AS value`,
      );
      const sequence = rows[0]?.value;
      if (sequence === undefined) throw new Error('service_code_seq returned no value.');

      // Older services are approved; the last few days stay pending, so the
      // approval queue has something in it to review.
      const approved = daysAgo > 3;

      await prisma.service.create({
        data: {
          serviceCode: String(sequence),
          serviceDate: day,
          driverId: assignment.driverId,
          vehicleId: vehicle.id,
          routeId: assignment.route.id,
          originSnapshot: assignment.route.origin,
          destinationSnapshot: assignment.route.destination,
          startDashboardKm,
          startBaseKm,
          endBaseKm,
          endDashboardKm,
          actualKm: endDashboardKm - startDashboardKm,
          serviceKm: endBaseKm - startBaseKm,
          departureTime: time(6 + (index % 4), (index * 15) % 60),
          arrivalTime: time(15 + (index % 5), (index * 20) % 60),
          endsNextDay: false,
          observations: index === 0 ? 'Entrega sin incidencias.' : null,
          status: approved ? 'APPROVED' : 'PENDING_APPROVAL',
          ...(approved
            ? {
                approvedAt: new Date(day.getTime() + 20 * 60 * 60 * 1000),
                approvedByUserId: admin.id,
              }
            : {}),
        },
      });

      created += 1;
    }
  }

  console.log(`Created ${created} demo services across the last ${DAYS} days.`);
}

main()
  .catch((error: unknown) => {
    console.error('\n' + (error instanceof Error ? error.message : String(error)) + '\n');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
