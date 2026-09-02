/**
 * Database access for routes/contracts (SRS 14, 19.5).
 */
import type { Prisma } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';

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
