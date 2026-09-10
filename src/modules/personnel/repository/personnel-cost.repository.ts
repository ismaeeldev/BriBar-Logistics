/**
 * Database access for personnel costs (ERP roadmap Phase 5).
 */
import type { Prisma } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';
import type { Pagination } from '@/modules/shared/schemas/common';
import { toPrismaPagination } from '@/modules/shared/schemas/common';

const PERSONNEL_COST_INCLUDE = {
  user: { select: { id: true, name: true } },
} satisfies Prisma.PersonnelCostInclude;

export type PersonnelCostWithRelations = Prisma.PersonnelCostGetPayload<{
  include: typeof PERSONNEL_COST_INCLUDE;
}>;

export const personnelCostRepository = {
  async findById(
    id: string,
    client: PrismaClientLike = prisma,
  ): Promise<PersonnelCostWithRelations | null> {
    return client.personnelCost.findUnique({ where: { id }, include: PERSONNEL_COST_INCLUDE });
  },

  async listPage(
    filters: { userId?: string; year?: number },
    pagination: Pagination,
    client: PrismaClientLike = prisma,
  ): Promise<{ items: PersonnelCostWithRelations[]; total: number }> {
    const where: Prisma.PersonnelCostWhereInput = {
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.year ? { year: filters.year } : {}),
    };

    const [items, total] = await Promise.all([
      client.personnelCost.findMany({
        where,
        include: PERSONNEL_COST_INCLUDE,
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        ...toPrismaPagination(pagination),
      }),
      client.personnelCost.count({ where }),
    ]);

    return { items, total };
  },

  async create(
    data: Prisma.PersonnelCostUncheckedCreateInput,
    client: PrismaClientLike = prisma,
  ): Promise<PersonnelCostWithRelations> {
    return client.personnelCost.create({ data, include: PERSONNEL_COST_INCLUDE });
  },

  async update(
    id: string,
    data: Prisma.PersonnelCostUncheckedUpdateInput,
    client: PrismaClientLike = prisma,
  ): Promise<PersonnelCostWithRelations> {
    return client.personnelCost.update({
      where: { id },
      data,
      include: PERSONNEL_COST_INCLUDE,
    });
  },

  async delete(id: string, client: PrismaClientLike = prisma): Promise<void> {
    await client.personnelCost.delete({ where: { id } });
  },
} as const;

export type PersonnelCostRepository = typeof personnelCostRepository;
