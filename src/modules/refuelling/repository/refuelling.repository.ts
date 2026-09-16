/**
 * Database access for refuellings (ERP roadmap Phase 2).
 */
import type { Prisma } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';
import type { Pagination } from '@/modules/shared/schemas/common';
import { toPrismaPagination } from '@/modules/shared/schemas/common';

const REFUELLING_INCLUDE = {
  vehicle: { select: { id: true, registrationPlate: true, referenceName: true } },
  driver: { select: { id: true, name: true } },
  fuelType: { select: { id: true, name: true } },
  gasStation: { select: { id: true, name: true } },
} satisfies Prisma.RefuellingInclude;

export type RefuellingWithRelations = Prisma.RefuellingGetPayload<{
  include: typeof REFUELLING_INCLUDE;
}>;

const REFUELLING_CODE_SEQUENCE = 'refuelling_code_seq';

export const refuellingRepository = {
  async findById(
    id: string,
    client: PrismaClientLike = prisma,
  ): Promise<RefuellingWithRelations | null> {
    return client.refuelling.findUnique({ where: { id }, include: REFUELLING_INCLUDE });
  },

  async listPage(
    filters: { vehicleId?: string },
    pagination: Pagination,
    client: PrismaClientLike = prisma,
  ): Promise<{ items: RefuellingWithRelations[]; total: number }> {
    const where: Prisma.RefuellingWhereInput = {
      ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
    };

    const [items, total] = await Promise.all([
      client.refuelling.findMany({
        where,
        include: REFUELLING_INCLUDE,
        orderBy: [{ refuelDate: 'desc' }, { createdAt: 'desc' }],
        ...toPrismaPagination(pagination),
      }),
      client.refuelling.count({ where }),
    ]);

    return { items, total };
  },

  /**
   * The chronologically previous refuel for the same vehicle — what
   * `kmSinceLast`/`consumptionMlPer100Km` (`domain/consumption.ts`) need.
   *
   * Ordered by `refuelDate` first and `odometerKm` second, not by
   * `createdAt`: two refuels entered in the same session for different
   * historical dates must still compare by the date they describe, not by
   * data-entry order. `excludeId` lets an edit find the row before *itself*
   * rather than finding itself back.
   */
  async previousForVehicle(
    vehicleId: string,
    beforeDate: Date,
    excludeId?: string,
    client: PrismaClientLike = prisma,
  ): Promise<{ odometerKm: number } | null> {
    return client.refuelling.findFirst({
      where: {
        vehicleId,
        refuelDate: { lte: beforeDate },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      orderBy: [{ refuelDate: 'desc' }, { odometerKm: 'desc' }],
      select: { odometerKm: true },
    });
  },

  /**
   * Allocates the next refuel code (ADR 0003's pattern, generalised by
   * `formatDocumentCode`). Same atomicity guarantee as
   * `serviceRepository.nextServiceSequence`: `nextval()` is never rolled
   * back, so two concurrent submissions can never collide.
   */
  async nextRefuelSequence(client: PrismaClientLike = prisma): Promise<bigint> {
    const rows = await client.$queryRawUnsafe<{ value: bigint }[]>(
      `SELECT nextval('${REFUELLING_CODE_SEQUENCE}') AS value`,
    );

    const value = rows[0]?.value;
    if (value === undefined) {
      throw new Error(`Sequence "${REFUELLING_CODE_SEQUENCE}" returned no value.`);
    }
    return value;
  },

  async create(
    data: Prisma.RefuellingUncheckedCreateInput,
    client: PrismaClientLike = prisma,
  ): Promise<RefuellingWithRelations> {
    return client.refuelling.create({ data, include: REFUELLING_INCLUDE });
  },

  async update(
    id: string,
    data: Prisma.RefuellingUncheckedUpdateInput,
    client: PrismaClientLike = prisma,
  ): Promise<RefuellingWithRelations> {
    return client.refuelling.update({ where: { id }, data, include: REFUELLING_INCLUDE });
  },

  async delete(id: string, client: PrismaClientLike = prisma): Promise<void> {
    await client.refuelling.delete({ where: { id } });
  },
} as const;

export type RefuellingRepository = typeof refuellingRepository;
export { REFUELLING_CODE_SEQUENCE };
