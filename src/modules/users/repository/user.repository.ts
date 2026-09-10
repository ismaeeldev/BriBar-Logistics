/**
 * Database access for users and their route assignments (SRS 12, 19.3, 19.6).
 *
 * ## The password hash never leaves this file
 *
 * `USER_SELECT` omits `passwordHash`, and every read below uses it. SRS 22.1
 * requires that no API response carry a hash; making the omission part of the
 * default projection means a handler cannot leak one by forgetting to strip it.
 * Authentication needs the hash and reads it separately, in
 * `src/lib/auth/index.ts`, with an explicit select that says so.
 */
import type { Prisma, Role } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';
import type { Pagination } from '@/modules/shared/schemas/common';
import { toPrismaPagination } from '@/modules/shared/schemas/common';

/** Everything a user view needs, and nothing that must not be exposed. */
const USER_SELECT = {
  id: true,
  name: true,
  loginIdentifier: true,
  role: true,
  isActive: true,
  defaultVehicleId: true,
  createdAt: true,
  updatedAt: true,
  defaultVehicle: {
    select: { id: true, registrationPlate: true, referenceName: true, isActive: true },
  },
  routeAssignments: {
    select: {
      routeId: true,
      isDefault: true,
      route: { select: { id: true, code: true, name: true, isActive: true } },
    },
    orderBy: [{ isDefault: 'desc' }, { route: { code: 'asc' } }],
  },
} satisfies Prisma.UserSelect;

export type UserWithRelations = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

export const userRepository = {
  async findById(
    id: string,
    client: PrismaClientLike = prisma,
  ): Promise<UserWithRelations | null> {
    return client.user.findUnique({ where: { id }, select: USER_SELECT });
  },

  async findByLoginIdentifier(
    loginIdentifier: string,
    client: PrismaClientLike = prisma,
  ): Promise<UserWithRelations | null> {
    return client.user.findUnique({
      where: { loginIdentifier: loginIdentifier.toLowerCase() },
      select: USER_SELECT,
    });
  },

  async list(
    filters: { role?: Role | undefined; isActive?: boolean | undefined },
    client: PrismaClientLike = prisma,
  ): Promise<UserWithRelations[]> {
    return client.user.findMany({
      where: {
        ...(filters.role ? { role: filters.role } : {}),
        ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }),
      },
      select: USER_SELECT,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
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
    filters: { role?: Role | undefined; isActive?: boolean | undefined; q?: string },
    pagination: Pagination,
    client: PrismaClientLike = prisma,
  ): Promise<{ items: UserWithRelations[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }),
      ...(filters.q ? {
        OR: [
          { name: { contains: filters.q, mode: 'insensitive' } },
          { loginIdentifier: { contains: filters.q, mode: 'insensitive' } },
        ]
      } : {})
    };

    let orderBy: Prisma.UserOrderByWithRelationInput[] = [{ isActive: 'desc' }, { name: 'asc' }];
    if (pagination.sort) {
      const dir = pagination.dir || 'asc';
      if (pagination.sort === 'defaultVehicle') {
        // Sort by the plate of the assigned default vehicle
        orderBy = [{ defaultVehicle: { registrationPlate: dir } }, { name: 'asc' }];
      } else if (pagination.sort === 'name' || pagination.sort === 'loginIdentifier' || pagination.sort === 'role' || pagination.sort === 'isActive') {
        // Direct scalar fields on User model
        orderBy = [{ [pagination.sort]: dir } as Prisma.UserOrderByWithRelationInput];
      }
      // defaultRoute is derived from routeAssignments (not a direct scalar), skip it
    }

    const [items, total] = await Promise.all([
      client.user.findMany({
        where,
        select: USER_SELECT,
        orderBy,
        ...toPrismaPagination(pagination),
      }),
      client.user.count({ where }),
    ]);

    return { items, total };
  },

  /**
   * What would stop this account being deleted.
   *
   * Route assignments are excluded for the same reason as on a route: they are
   * configuration and go with the account. Audit rows are excluded too — that
   * foreign key is `SetNull` precisely so the trail outlives the actor.
   */
  /**
   * What would stop this user being deleted. `refuellings` (as the driver a
   * fill-up was for — ERP roadmap Phase 2) and `dailyKmLogs`/`personnelCosts`
   * (Phase 5) joined `services`/`approvals`/`statusChanges` here as each
   * module gave a user a new way to be referenced — the same pattern
   * `vehicleRepository.countDependents`'s own doc comment describes.
   */
  async countDependents(
    id: string,
    client: PrismaClientLike = prisma,
  ): Promise<{
    services: number;
    approvals: number;
    statusChanges: number;
    refuellings: number;
    dailyKmLogs: number;
    personnelCosts: number;
  }> {
    const [services, approvals, statusChanges, refuellings, dailyKmLogs, personnelCosts] =
      await Promise.all([
        client.service.count({ where: { driverId: id } }),
        client.service.count({ where: { approvedByUserId: id } }),
        client.serviceStatusHistory.count({ where: { changedByUserId: id } }),
        client.refuelling.count({ where: { driverId: id } }),
        client.dailyKmLog.count({ where: { driverId: id } }),
        client.personnelCost.count({ where: { userId: id } }),
      ]);

    return { services, approvals, statusChanges, refuellings, dailyKmLogs, personnelCosts };
  },

  async countRouteAssignments(id: string, client: PrismaClientLike = prisma): Promise<number> {
    return client.driverRoute.count({ where: { driverId: id } });
  },

  async delete(id: string, client: PrismaClientLike = prisma): Promise<void> {
    await client.driverRoute.deleteMany({ where: { driverId: id } });
    await client.user.delete({ where: { id } });
  },

  async create(
    data: Prisma.UserUncheckedCreateInput,
    client: PrismaClientLike = prisma,
  ): Promise<UserWithRelations> {
    return client.user.create({ data, select: USER_SELECT });
  },

  async update(
    id: string,
    data: Prisma.UserUncheckedUpdateInput,
    client: PrismaClientLike = prisma,
  ): Promise<UserWithRelations> {
    return client.user.update({ where: { id }, data, select: USER_SELECT });
  },

  /** Raw record including the hash. Only authentication and password changes. */
  async findCredentials(id: string, client: PrismaClientLike = prisma) {
    return client.user.findUnique({
      where: { id },
      select: { id: true, passwordHash: true, isActive: true, role: true },
    });
  },

  // -------------------------------------------------------------------------
  // Route assignments (SRS 12.6, 19.6)
  // -------------------------------------------------------------------------

  /**
   * The routes a driver may select, filtered to those still usable.
   *
   * SRS 14.3: "a Driver shall only be able to select from routes currently
   * assigned to that Driver **and active for use**". Both halves are in the
   * query, so an inactive route cannot reach a picker or pass a server-side
   * check.
   */
  async listAssignableRoutes(driverId: string, client: PrismaClientLike = prisma) {
    return client.driverRoute.findMany({
      where: { driverId, route: { isActive: true } },
      select: {
        isDefault: true,
        route: {
          select: { id: true, code: true, name: true, origin: true, destination: true },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { route: { code: 'asc' } }],
    });
  },

  /**
   * Whether this driver may use this route right now.
   *
   * A single indexed lookup rather than fetching the whole assignment list and
   * searching it — this runs on every service write (SRS 26.2: "Unassigned
   * routes ... are rejected server-side if manually submitted").
   */
  async isRouteAssignable(
    driverId: string,
    routeId: string,
    client: PrismaClientLike = prisma,
  ): Promise<boolean> {
    const found = await client.driverRoute.findFirst({
      where: { driverId, routeId, route: { isActive: true } },
      select: { id: true },
    });
    return found !== null;
  },

  /**
   * Replaces a driver's assignments wholesale (SRS 18.4, `PUT`).
   *
   * Delete-then-insert rather than a diff. The partial unique index allows only
   * one default per driver, so moving the default from route A to route B by
   * updating rows individually would transiently violate it depending on
   * ordering. Clearing first sidesteps that entirely, and the caller runs it
   * inside a transaction so no window exists where the driver has no routes.
   */
  async replaceRouteAssignments(
    driverId: string,
    assignments: { routeId: string; isDefault: boolean }[],
    client: PrismaClientLike = prisma,
  ): Promise<void> {
    await client.driverRoute.deleteMany({ where: { driverId } });

    if (assignments.length === 0) return;

    await client.driverRoute.createMany({
      data: assignments.map((assignment) => ({ driverId, ...assignment })),
    });
  },

  async countServices(driverId: string, client: PrismaClientLike = prisma): Promise<number> {
    return client.service.count({ where: { driverId } });
  },
} as const;

export type UserRepository = typeof userRepository;
