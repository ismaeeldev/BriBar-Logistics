/**
 * Database access for vehicles (SRS 13, 19.4).
 */
import type { Prisma } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';
import type { Pagination } from '@/modules/shared/schemas/common';
import { toPrismaPagination } from '@/modules/shared/schemas/common';

const VEHICLE_SELECT = {
  id: true,
  registrationPlate: true,
  referenceName: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      services: true,
      defaultForUsers: true,
    },
  },
} satisfies Prisma.VehicleSelect;

export type VehicleRecord = Prisma.VehicleGetPayload<{ select: typeof VEHICLE_SELECT }>;

/** Columns the admin list may be sorted by. Anything else is ignored so a
 * hand-crafted `?sort=` cannot reach Prisma as an invalid orderBy key. */
const SORTABLE_COLUMNS = new Set(['registrationPlate', 'referenceName', 'isActive']);

export const vehicleRepository = {
  async findById(id: string, client: PrismaClientLike = prisma): Promise<VehicleRecord | null> {
    return client.vehicle.findUnique({ where: { id }, select: VEHICLE_SELECT });
  },

  /**
   * SRS 13.2: an administrator sees active and inactive vehicles. Pass
   * `isActive: true` for a driver-facing picker, where SRS 13.4 requires
   * deactivated vehicles not to be offered.
   */
  async list(
    filters: { isActive?: boolean | undefined },
    client: PrismaClientLike = prisma,
  ): Promise<VehicleRecord[]> {
    return client.vehicle.findMany({
      where: filters.isActive === undefined ? {} : { isActive: filters.isActive },
      select: VEHICLE_SELECT,
      orderBy: [{ isActive: 'desc' }, { registrationPlate: 'asc' }],
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
  ): Promise<{ items: VehicleRecord[]; total: number }> {
    const where: Prisma.VehicleWhereInput = {
      ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }),
      ...(filters.q ? {
        OR: [
          { registrationPlate: { contains: filters.q, mode: 'insensitive' } },
          { referenceName: { contains: filters.q, mode: 'insensitive' } },
        ]
      } : {})
    };

    let orderBy: Prisma.VehicleOrderByWithRelationInput[] = [
      { isActive: 'desc' },
      { registrationPlate: 'asc' },
    ];
    if (pagination.sort && SORTABLE_COLUMNS.has(pagination.sort)) {
      const dir = pagination.dir ?? 'asc';
      orderBy = [{ [pagination.sort]: dir } as Prisma.VehicleOrderByWithRelationInput, ...orderBy];
    }

    const [items, total] = await Promise.all([
      client.vehicle.findMany({
        where,
        select: VEHICLE_SELECT,
        orderBy,
        ...toPrismaPagination(pagination),
      }),
      client.vehicle.count({ where }),
    ]);

    return { items, total };
  },

  /**
   * What would stop this vehicle being deleted.
   *
   * Asked before the button is drawn rather than after it is pressed: the
   * screen can then say "3 services use this vehicle" instead of failing with
   * a foreign-key error the administrator has to interpret. `refuellings`
   * (ERP roadmap Phase 2), `receivedInvoices` (Phase 3) and
   * `dailyKmLogs`/`maintenanceRecords` (Phase 5) joined `services` and
   * `defaultForUsers` here as soon as each module gave a vehicle a new way
   * to be referenced.
   */
  async countDependents(
    id: string,
    client: PrismaClientLike = prisma,
  ): Promise<{
    services: number;
    defaultForUsers: number;
    refuellings: number;
    receivedInvoices: number;
    dailyKmLogs: number;
    maintenanceRecords: number;
  }> {
    const [
      services,
      defaultForUsers,
      refuellings,
      receivedInvoices,
      dailyKmLogs,
      maintenanceRecords,
    ] = await Promise.all([
      client.service.count({ where: { vehicleId: id } }),
      client.user.count({ where: { defaultVehicleId: id } }),
      client.refuelling.count({ where: { vehicleId: id } }),
      client.receivedInvoice.count({ where: { vehicleId: id } }),
      client.dailyKmLog.count({ where: { vehicleId: id } }),
      client.maintenanceRecord.count({ where: { vehicleId: id } }),
    ]);

    return {
      services,
      defaultForUsers,
      refuellings,
      receivedInvoices,
      dailyKmLogs,
      maintenanceRecords,
    };
  },

  async delete(id: string, client: PrismaClientLike = prisma): Promise<void> {
    await client.vehicle.delete({ where: { id } });
  },

  async create(
    data: Prisma.VehicleCreateInput,
    client: PrismaClientLike = prisma,
  ): Promise<VehicleRecord> {
    return client.vehicle.create({ data, select: VEHICLE_SELECT });
  },

  async update(
    id: string,
    data: Prisma.VehicleUpdateInput,
    client: PrismaClientLike = prisma,
  ): Promise<VehicleRecord> {
    return client.vehicle.update({ where: { id }, data, select: VEHICLE_SELECT });
  },

  /** Whether this vehicle may be chosen for a new service (SRS 13.5). */
  async isSelectable(id: string, client: PrismaClientLike = prisma): Promise<boolean> {
    const found = await client.vehicle.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });
    return found !== null;
  },
} as const;

export type VehicleRepository = typeof vehicleRepository;
