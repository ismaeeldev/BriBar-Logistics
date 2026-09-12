/**
 * Database access for routes/contracts (SRS 14, 19.5).
 */
import type { Prisma } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';
import type { Pagination } from '@/modules/shared/schemas/common';
import { toPrismaPagination } from '@/modules/shared/schemas/common';

const ROUTE_SELECT = {
  id: true,
  code: true,
  name: true,
  origin: true,
  destination: true,
  // Admin-only. Safe here because every caller of this repository is already
  // gated by `routeService`'s `assertAdmin` — a driver's route picker comes
  // from `userRepository.listAssignableRoutes`, a separate query that never
  // selects this column.
  defaultRateCents: true,
  // ERP roadmap Phase 4. Same admin-only reasoning as `defaultRateCents`.
  clientId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RouteSelect;

export type RouteRecord = Prisma.RouteGetPayload<{ select: typeof ROUTE_SELECT }>;

/** Columns the admin list may be sorted by. Anything else is ignored so a
 * hand-crafted `?sort=` cannot reach Prisma as an invalid orderBy key. */
const SORTABLE_COLUMNS = new Set(['code', 'name', 'isActive']);

export const routeRepository = {
  async findById(id: string, client: PrismaClientLike = prisma): Promise<RouteRecord | null> {
    return client.route.findUnique({ where: { id }, select: ROUTE_SELECT });
  },

  async list(
    filters: { isActive?: boolean | undefined },
    client: PrismaClientLike = prisma,
  ): Promise<RouteRecord[]> {
    return client.route.findMany({
      where: filters.isActive === undefined ? {} : { isActive: filters.isActive },
      select: ROUTE_SELECT,
      orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
    });
  },

  /**
   * One page of the list, with the total the page came from.
   *
   * Separate from `list` on purpose. `list` fills the filter pickers, which
   * need every option or they silently hide records from the filtered view;
   * this is what a screen renders, and it must not grow without bound as the
   * table does. Both share the same `where` and the same ordering, so page 2
   * is genuinely the continuation of page 1.
   */
  async listPage(
    filters: { isActive?: boolean | undefined; q?: string },
    pagination: Pagination,
    client: PrismaClientLike = prisma,
  ): Promise<{ items: RouteRecord[]; total: number }> {
    const where: Prisma.RouteWhereInput = {
      ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }),
      ...(filters.q ? {
        OR: [
          { code: { contains: filters.q, mode: 'insensitive' } },
          { name: { contains: filters.q, mode: 'insensitive' } },
          { origin: { contains: filters.q, mode: 'insensitive' } },
          { destination: { contains: filters.q, mode: 'insensitive' } },
        ]
      } : {})
    };

    let orderBy: Prisma.RouteOrderByWithRelationInput[] = [{ isActive: 'desc' }, { code: 'asc' }];
    if (pagination.sort && SORTABLE_COLUMNS.has(pagination.sort)) {
      const dir = pagination.dir ?? 'asc';
      orderBy = [{ [pagination.sort]: dir } as Prisma.RouteOrderByWithRelationInput, ...orderBy];
    }

    const [items, total] = await Promise.all([
      client.route.findMany({
        where,
        select: ROUTE_SELECT,
        orderBy,
        ...toPrismaPagination(pagination),
      }),
      client.route.count({ where }),
    ]);

    return { items, total };
  },

  /**
   * What would stop this route being deleted.
   *
   * Driver assignments are not in this list. They are configuration, not
   * history, and are removed alongside the route — the confirmation says how
   * many, so nobody loses an assignment silently. `dailyKmLogs` (ERP
   * roadmap Phase 5) joined `services` once a daily km entry could name a
   * route too.
   */
  async countDependents(
    id: string,
    client: PrismaClientLike = prisma,
  ): Promise<{ services: number; assignedDrivers: number; dailyKmLogs: number }> {
    const [services, assignedDrivers, dailyKmLogs] = await Promise.all([
      client.service.count({ where: { routeId: id } }),
      client.driverRoute.count({ where: { routeId: id } }),
      client.dailyKmLog.count({ where: { routeId: id } }),
    ]);

    return { services, assignedDrivers, dailyKmLogs };
  },

  async delete(id: string, client: PrismaClientLike = prisma): Promise<void> {
    await client.driverRoute.deleteMany({ where: { routeId: id } });
    await client.route.delete({ where: { id } });
  },

  async create(
    // Unchecked, not the "checked" `RouteCreateInput` — ERP roadmap Phase 4's
    // `clientId` is a foreign-key scalar, and the checked variant replaces
    // every FK scalar with `client: { connect: { id } }` relation syntax
    // instead of accepting the column directly. `defaultRateCents` was never
    // affected (it isn't a foreign key), which is why this went unnoticed
    // until a real FK column was added here.
    data: Prisma.RouteUncheckedCreateInput,
    client: PrismaClientLike = prisma,
  ): Promise<RouteRecord> {
    return client.route.create({ data, select: ROUTE_SELECT });
  },

  async update(
    id: string,
    data: Prisma.RouteUncheckedUpdateInput,
    client: PrismaClientLike = prisma,
  ): Promise<RouteRecord> {
    return client.route.update({ where: { id }, data, select: ROUTE_SELECT });
  },

  /**
   * How many drivers are assigned this route.
   *
   * Deactivating a route silently removes it from those drivers' pickers, so
   * the admin UI warns first (SRS 24.2 in spirit: tell the user what their
   * action will do to someone else).
   */
  async countAssignedDrivers(id: string, client: PrismaClientLike = prisma): Promise<number> {
    return client.driverRoute.count({ where: { routeId: id } });
  },

  /**
   * Whether this route may be chosen for a new service by a driver with no
   * assignments of their own (free-choice fallback, client decision
   * 2026-09-13) - the same active-only gate `vehicleRepository.isSelectable`
   * applies to vehicles (SRS 13.5).
   */
  async isSelectable(id: string, client: PrismaClientLike = prisma): Promise<boolean> {
    const found = await client.route.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });
    return found !== null;
  },
} as const;

export type RouteRepository = typeof routeRepository;
