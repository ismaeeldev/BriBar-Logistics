/**
 * Database access for vehicles (SRS 13, 19.4).
 */
import type { Prisma } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';

const VEHICLE_SELECT = {
  id: true,
  registrationPlate: true,
  referenceName: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VehicleSelect;

export type VehicleRecord = Prisma.VehicleGetPayload<{ select: typeof VEHICLE_SELECT }>;

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
