/**
 * Database access for services (SRS 30.1).
 *
 * The only module that writes Prisma queries against `services`. Everything
 * above it — the service layer, route handlers, pages — works with the shapes
 * declared here and never sees a `where` clause.
 *
 * ## Ownership is enforced in SQL, not after the read
 *
 * `findByIdForActor` takes the actor and pushes `driverId` into the query for a
 * driver. A foreign record is therefore never fetched, and the caller gets
 * `null` — which becomes a 404. That is deliberate: SRS 18.7 defines 404 as
 * "not found *or not visible to caller*", and SRS 24.3 forbids confirming that
 * a protected record exists. Loading the row and then checking ownership would
 * produce the same status code but leak timing, and invites the eventual bug
 * where someone forgets the second step.
 */
import type { Prisma, PrismaClient, Service, ServiceStatus } from '@prisma/client';
// The enum's *values* are needed here as well as its type: the summary
// queries below name statuses rather than receiving them from a caller.
import { ServiceStatus as ServiceStatusValue } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';
import { businessDateRange } from '@/lib/time/business-date';
import { Role, type ServiceActor } from '../domain/service-status';
import { SERVICE_CODE_SEQUENCE } from '../domain/service-code';

/**
 * Relations every service view needs.
 *
 * Declared once so a list row and a detail page cannot disagree about what a
 * service looks like, and so adding a column is a single edit.
 */
const SERVICE_INCLUDE = {
  driver: { select: { id: true, name: true, loginIdentifier: true } },
  vehicle: {
    select: { id: true, registrationPlate: true, referenceName: true, isActive: true },
  },
  route: { select: { id: true, code: true, name: true, isActive: true } },
  approvedBy: { select: { id: true, name: true } },
} satisfies Prisma.ServiceInclude;

export type ServiceWithRelations = Prisma.ServiceGetPayload<{
  include: typeof SERVICE_INCLUDE;
}>;

export interface ServiceFilters {
  driverId?: string | undefined;
  vehicleId?: string | undefined;
  routeId?: string | undefined;
  status?: ServiceStatus[] | undefined;
  dateFrom?: Date | null;
  dateTo?: Date | null;
}

/**
 * Builds the `where` clause shared by list and count.
 *
 * `visibleTo` is applied last and cannot be overridden by a filter — a driver
 * passing `?driverId=` for somebody else still only matches their own rows
 * (SRS 9.7, 26.8).
 */
function buildWhere(
  filters: ServiceFilters,
  visibleTo: ServiceActor,
): Prisma.ServiceWhereInput {
  const where: Prisma.ServiceWhereInput = {};

  if (filters.vehicleId) where.vehicleId = filters.vehicleId;
  if (filters.routeId) where.routeId = filters.routeId;
  if (filters.status?.length) where.status = { in: filters.status };

  const range = businessDateRange(filters.dateFrom ?? null, filters.dateTo ?? null);
  if (range.gte || range.lt) where.serviceDate = range;

  if (visibleTo.role === Role.ADMIN) {
    if (filters.driverId) where.driverId = filters.driverId;
  } else {
    // Overwrites whatever the caller asked for. This is the line that makes
    // "Driver ID substitution fails" (SRS 26.8) structural.
    where.driverId = visibleTo.userId;
  }

  return where;
}

export const serviceRepository = {
  /**
   * One service, or `null` when it does not exist *or* is not this actor's to
   * see.
   */
  async findByIdForActor(
    id: string,
    actor: ServiceActor,
    client: PrismaClientLike = prisma,
  ): Promise<ServiceWithRelations | null> {
    return client.service.findFirst({
      where: actor.role === Role.ADMIN ? { id } : { id, driverId: actor.userId },
      include: SERVICE_INCLUDE,
    });
  },

  /** A page of services, newest business date first. */
  async list(
    filters: ServiceFilters,
    visibleTo: ServiceActor,
    pagination: { skip: number; take: number },
    client: PrismaClientLike = prisma,
  ): Promise<{ items: ServiceWithRelations[]; total: number }> {
    const where = buildWhere(filters, visibleTo);

    // One round trip rather than two sequential ones. Both statements see the
    // same snapshot, so the count cannot disagree with the page.
    const [items, total] = await Promise.all([
      client.service.findMany({
        where,
        include: SERVICE_INCLUDE,
        // `createdAt` breaks ties within a day so pagination is stable; without
        // it, two services on the same date could swap places between pages.
        orderBy: [{ serviceDate: 'desc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      client.service.count({ where }),
    ]);

    return { items, total };
  },

  /** The most recent services for a dashboard panel (SRS 15.2, 16.2). */
  async listRecent(
    visibleTo: ServiceActor,
    status: ServiceStatus[] | undefined,
    take: number,
    client: PrismaClientLike = prisma,
  ): Promise<ServiceWithRelations[]> {
    return client.service.findMany({
      where: buildWhere({ ...(status ? { status } : {}) }, visibleTo),
      include: SERVICE_INCLUDE,
      orderBy: [{ serviceDate: 'desc' }, { createdAt: 'desc' }],
      take,
    });
  },

  async countByStatus(
    visibleTo: ServiceActor,
    status: ServiceStatus,
    client: PrismaClientLike = prisma,
  ): Promise<number> {
    return client.service.count({ where: buildWhere({ status: [status] }, visibleTo) });
  },

  /**
   * Allocates the next Service ID (SRS 19.1, 23.4).
   *
   * `nextval()` is atomic and is deliberately *not* rolled back by a failed
   * transaction, so two concurrent submissions can never receive the same
   * number. See `domain/service-code.ts` for why gaps are the accepted cost.
   */
  async nextServiceSequence(client: PrismaClientLike = prisma): Promise<bigint> {
    const rows = await client.$queryRawUnsafe<{ value: bigint }[]>(
      `SELECT nextval('${SERVICE_CODE_SEQUENCE}') AS value`,
    );

    const value = rows[0]?.value;
    if (value === undefined) {
      throw new Error(`Sequence "${SERVICE_CODE_SEQUENCE}" returned no value.`);
    }
    return value;
  },

  async create(
    data: Prisma.ServiceUncheckedCreateInput,
    client: PrismaClientLike = prisma,
  ): Promise<ServiceWithRelations> {
    return client.service.create({ data, include: SERVICE_INCLUDE });
  },

  /**
   * Updates a service, but **only while it still matches `expectedStatus`**.
   *
   * This is the SRS 24.4 race, closed at the database rather than in the
   * application: a driver opens a pending service, an administrator approves it
   * in the meantime, and the driver saves. Checking the status in JavaScript
   * before calling `update` leaves a window between the read and the write.
   * Folding the status into the `where` clause closes it — the row either
   * matches at the instant of the write or it does not.
   *
   * Returns `null` when nothing matched, which the service layer turns into a
   * 409 rather than a 404.
   */
  async updateIfStatus(
    id: string,
    expectedStatus: ServiceStatus,
    // Scalars only. `updateMany` cannot express a relation connect, so the
    // type says so rather than accepting a wider input and casting - the cast
    // compiled and then failed at runtime.
    data: Prisma.ServiceUncheckedUpdateManyInput,
    client: PrismaClientLike = prisma,
  ): Promise<ServiceWithRelations | null> {
    const result = await client.service.updateMany({
      where: { id, status: expectedStatus },
      data,
    });

    if (result.count === 0) return null;

    return client.service.findUniqueOrThrow({ where: { id }, include: SERVICE_INCLUDE });
  },

  /** Unconditional update, for an administrator editing an approved service. */
  async update(
    id: string,
    data: Prisma.ServiceUncheckedUpdateInput,
    client: PrismaClientLike = prisma,
  ): Promise<ServiceWithRelations> {
    return client.service.update({ where: { id }, data, include: SERVICE_INCLUDE });
  },

  /**
   * Services and kilometres per business day, for the dashboard trend.
   *
   * Grouped in the database rather than by pulling rows and reducing in
   * JavaScript: the dashboard must stay cheap as the services table grows, and
   * `services_service_date_idx` already backs this exact grouping (SRS 19.10).
   *
   * Days with no activity are absent from the result - a `GROUP BY` cannot
   * invent rows that do not exist. The service layer fills the gaps, because a
   * trend line with holes in it reads as missing data rather than a quiet day.
   */
  async dailyActivity(
    visibleTo: ServiceActor,
    from: Date,
    client: PrismaClientLike = prisma,
  ): Promise<{ serviceDate: Date; services: number; actualKm: number }[]> {
    const grouped = await client.service.groupBy({
      by: ['serviceDate'],
      where: { ...buildWhere({}, visibleTo), serviceDate: { gte: from } },
      _count: { _all: true },
      _sum: { actualKm: true },
      orderBy: { serviceDate: 'asc' },
    });

    return grouped.map((row) => ({
      serviceDate: row.serviceDate,
      services: row._count._all,
      actualKm: row._sum.actualKm ?? 0,
    }));
  },

  /**
   * Contracted kilometres per route, busiest first (SRS 28.6 anticipates this
   * kind of aggregation; here it is a dashboard summary, not a report).
   *
   * Two queries rather than a join: `groupBy` cannot select through a relation,
   * and fetching the handful of routes it returns by id is cheaper than the
   * raw SQL it would take to avoid the round trip.
   */
  async routeTotals(
    visibleTo: ServiceActor,
    limit: number,
    from: Date,
    client: PrismaClientLike = prisma,
  ): Promise<
    {
      routeId: string;
      code: string;
      name: string;
      origin: string;
      destination: string;
      services: number;
      serviceKm: number;
    }[]
  > {
    const grouped = await client.service.groupBy({
      by: ['routeId'],
      where: { ...buildWhere({}, visibleTo), serviceDate: { gte: from } },
      _count: { _all: true },
      _sum: { serviceKm: true },
      orderBy: { _sum: { serviceKm: 'desc' } },
      take: limit,
    });

    if (grouped.length === 0) return [];

    const routes = await client.route.findMany({
      where: { id: { in: grouped.map((row) => row.routeId) } },
      // Origin and destination so the ranking can name the journey rather than
      // only the contract. The route's current values are right here: this is
      // a summary of routes, not a record of what a past service ran under.
      select: { id: true, code: true, name: true, origin: true, destination: true },
    });
    const byId = new Map(routes.map((route) => [route.id, route]));

    return grouped.flatMap((row) => {
      const route = byId.get(row.routeId);
      if (!route) return [];
      return [
        {
          routeId: row.routeId,
          code: route.code,
          name: route.name,
          origin: route.origin,
          destination: route.destination,
          services: row._count._all,
          serviceKm: row._sum.serviceKm ?? 0,
        },
      ];
    });
  },

  /** Headline totals for the stat tiles. */
  async totals(
    visibleTo: ServiceActor,
    from: Date,
    client: PrismaClientLike = prisma,
  ): Promise<{ services: number; actualKm: number; serviceKm: number }> {
    const result = await client.service.aggregate({
      where: { ...buildWhere({}, visibleTo), serviceDate: { gte: from } },
      _count: { _all: true },
      _sum: { actualKm: true, serviceKm: true },
    });

    return {
      services: result._count._all,
      actualKm: result._sum.actualKm ?? 0,
      serviceKm: result._sum.serviceKm ?? 0,
    };
  },

  /**
   * Totals over a half-open business-date interval.
   *
   * Half-open (`gte` / `lt`) so "this week" and "last week" can be adjacent
   * without either double-counting the boundary day or dropping it. `totals`
   * is the open-ended case and stays as it is, because the dashboard windows
   * that use it genuinely have no end.
   */
  async totalsBetween(
    visibleTo: ServiceActor,
    from: Date,
    to: Date,
    client: PrismaClientLike = prisma,
  ): Promise<{ services: number; actualKm: number; serviceKm: number }> {
    const result = await client.service.aggregate({
      where: { ...buildWhere({}, visibleTo), serviceDate: { gte: from, lt: to } },
      _count: { _all: true },
      _sum: { actualKm: true, serviceKm: true },
    });

    return {
      services: result._count._all,
      actualKm: result._sum.actualKm ?? 0,
      serviceKm: result._sum.serviceKm ?? 0,
    };
  },

  /**
   * How one business day splits by status.
   *
   * One grouped query rather than three counts: the dashboard asks this for
   * today on every load, and the three numbers have to agree with each other —
   * separate queries could be answered either side of an approval.
   */
  async countsByStatusOnDate(
    visibleTo: ServiceActor,
    date: Date,
    client: PrismaClientLike = prisma,
  ): Promise<{ total: number; pending: number; approved: number }> {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + 1);

    const grouped = await client.service.groupBy({
      by: ['status'],
      where: { ...buildWhere({}, visibleTo), serviceDate: { gte: date, lt: next } },
      _count: { _all: true },
    });

    const count = (status: ServiceStatus) =>
      grouped.find((row) => row.status === status)?._count._all ?? 0;

    const pending = count(ServiceStatusValue.PENDING_APPROVAL);
    const approved = count(ServiceStatusValue.APPROVED);

    return { total: pending + approved, pending, approved };
  },

  /**
   * Pending services dated before `before`, oldest first.
   *
   * Dated, not created: a sheet filed for last Tuesday that is still waiting is
   * the thing an administrator needs to see, whether it was typed in on Tuesday
   * or this morning.
   */
  async listStalePending(
    visibleTo: ServiceActor,
    before: Date,
    take: number,
    client: PrismaClientLike = prisma,
  ): Promise<ServiceWithRelations[]> {
    return client.service.findMany({
      where: {
        ...buildWhere({ status: [ServiceStatusValue.PENDING_APPROVAL] }, visibleTo),
        serviceDate: { lt: before },
      },
      include: SERVICE_INCLUDE,
      orderBy: [{ serviceDate: 'asc' }, { createdAt: 'asc' }],
      take,
    });
  },

  /**
   * What each of these routes normally costs to run, from its own history.
   *
   * There is no planned or contracted distance anywhere in the schema — a route
   * has an origin and a destination and nothing else — so "normal" can only
   * mean "what this route has actually taken before". Approved services only,
   * because an unreviewed reading is exactly the thing being checked against.
   *
   * The sample size comes back with the average so the caller can decline to
   * have an opinion: one previous service is not a baseline, and flagging a
   * route the second time it ever runs would be noise.
   */
  async routeBaselines(
    visibleTo: ServiceActor,
    routeIds: string[],
    client: PrismaClientLike = prisma,
  ): Promise<Map<string, { averageActualKm: number; sample: number }>> {
    if (routeIds.length === 0) return new Map();

    const grouped = await client.service.groupBy({
      by: ['routeId'],
      where: {
        ...buildWhere({ status: [ServiceStatusValue.APPROVED] }, visibleTo),
        routeId: { in: routeIds },
      },
      _avg: { actualKm: true },
      _count: { _all: true },
    });

    return new Map(
      grouped.map((row) => [
        row.routeId,
        { averageActualKm: Math.round(row._avg.actualKm ?? 0), sample: row._count._all },
      ]),
    );
  },

  /** Appends a transition to the history (SRS 19.8, 21.2). */
  async recordStatusChange(
    entry: {
      serviceId: string;
      fromStatus: ServiceStatus | null;
      toStatus: ServiceStatus;
      changedByUserId: string;
    },
    client: PrismaClientLike = prisma,
  ): Promise<void> {
    await client.serviceStatusHistory.create({ data: entry });
  },

  async listStatusHistory(serviceId: string, client: PrismaClientLike = prisma) {
    return client.serviceStatusHistory.findMany({
      where: { serviceId },
      include: { changedBy: { select: { id: true, name: true } } },
      orderBy: { changedAt: 'asc' },
    });
  },
} as const;

export type ServiceRepository = typeof serviceRepository;
export type { Service, PrismaClient };
