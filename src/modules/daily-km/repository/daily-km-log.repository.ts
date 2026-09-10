/**
 * Database access for daily km logs (ERP roadmap Phase 5).
 */
import type { Prisma } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';
import type { Pagination } from '@/modules/shared/schemas/common';
import { toPrismaPagination } from '@/modules/shared/schemas/common';

const DAILY_KM_LOG_INCLUDE = {
  vehicle: { select: { id: true, registrationPlate: true, referenceName: true } },
  route: { select: { id: true, code: true, name: true } },
  driver: { select: { id: true, name: true } },
} satisfies Prisma.DailyKmLogInclude;

export type DailyKmLogWithRelations = Prisma.DailyKmLogGetPayload<{
  include: typeof DAILY_KM_LOG_INCLUDE;
}>;

export const dailyKmLogRepository = {
  async findById(
    id: string,
    client: PrismaClientLike = prisma,
  ): Promise<DailyKmLogWithRelations | null> {
    return client.dailyKmLog.findUnique({ where: { id }, include: DAILY_KM_LOG_INCLUDE });
  },

  async listPage(
    filters: { vehicleId?: string },
    pagination: Pagination,
    client: PrismaClientLike = prisma,
  ): Promise<{ items: DailyKmLogWithRelations[]; total: number }> {
    const where: Prisma.DailyKmLogWhereInput = {
      ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
    };

    const [items, total] = await Promise.all([
      client.dailyKmLog.findMany({
        where,
        include: DAILY_KM_LOG_INCLUDE,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        ...toPrismaPagination(pagination),
      }),
      client.dailyKmLog.count({ where }),
    ]);

    return { items, total };
  },

  /**
   * The most recent reading at or before a date, for a vehicle — what
   * `maintenanceService`'s "current odometer" estimate reads alongside the
   * equivalent `Refuelling` query (`refuellingRepository.previousForVehicle`).
   */
  async mostRecentForVehicle(
    vehicleId: string,
    client: PrismaClientLike = prisma,
  ): Promise<{ date: Date; actualKm: number } | null> {
    return client.dailyKmLog.findFirst({
      where: { vehicleId },
      orderBy: { date: 'desc' },
      select: { date: true, actualKm: true },
    });
  },

  async create(
    data: Prisma.DailyKmLogUncheckedCreateInput,
    client: PrismaClientLike = prisma,
  ): Promise<DailyKmLogWithRelations> {
    return client.dailyKmLog.create({ data, include: DAILY_KM_LOG_INCLUDE });
  },

  async update(
    id: string,
    data: Prisma.DailyKmLogUncheckedUpdateInput,
    client: PrismaClientLike = prisma,
  ): Promise<DailyKmLogWithRelations> {
    return client.dailyKmLog.update({ where: { id }, data, include: DAILY_KM_LOG_INCLUDE });
  },

  async delete(id: string, client: PrismaClientLike = prisma): Promise<void> {
    await client.dailyKmLog.delete({ where: { id } });
  },
} as const;

export type DailyKmLogRepository = typeof dailyKmLogRepository;
