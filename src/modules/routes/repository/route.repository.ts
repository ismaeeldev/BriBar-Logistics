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
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RouteSelect;

export type RouteRecord = Prisma.RouteGetPayload<{ select: typeof ROUTE_SELECT }>;

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
    filters: { isActive?: boolean | undefined },
    pagination: Pagination,
    client: PrismaClientLike = prisma,
  ): Promise<{ items: RouteRecord[]; total: number }> {
    const where = filters.isActive === undefined ? {} : { isActive: filters.isActive };

    const [items, total] = await Promise.all([
      client.route.findMany({
        where,
        select: ROUTE_SELECT,
        orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
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
   * many, so nobody loses an assignment silently.
   */
  async countDependents(
    id: string,
    client: PrismaClientLike = prisma,
  ): Promise<{ services: number; assignedDrivers: number }> {
    const [services, assignedDrivers] = await Promise.all([
      client.service.count({ where: { routeId: id } }),
      client.driverRoute.count({ where: { routeId: id } }),
    ]);

    return { services, assignedDrivers };
  },

  async delete(id: string, client: PrismaClientLike = prisma): Promise<void> {
    await client.driverRoute.deleteMany({ where: { routeId: id } });
    await client.route.delete({ where: { id } });
  },

  async create(
    data: Prisma.RouteCreateInput,
    client: PrismaClientLike = prisma,
  ): Promise<RouteRecord> {
    return client.route.create({ data, select: ROUTE_SELECT });
  },

  async update(
    id: string,
    data: Prisma.RouteUpdateInput,
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
} as const;

export type RouteRepository = typeof routeRepository;
