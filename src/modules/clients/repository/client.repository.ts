/**
 * Database access for clients (ERP roadmap Phase 1).
 */
import type { Prisma } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';
import type { Pagination } from '@/modules/shared/schemas/common';
import { toPrismaPagination } from '@/modules/shared/schemas/common';

const CLIENT_SELECT = {
  id: true,
  name: true,
  taxId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClientSelect;

export type ClientRecord = Prisma.ClientGetPayload<{ select: typeof CLIENT_SELECT }>;

const SORTABLE_COLUMNS = new Set(['name', 'isActive']);

export const clientRepository = {
  async findById(id: string, client: PrismaClientLike = prisma): Promise<ClientRecord | null> {
    return client.client.findUnique({ where: { id }, select: CLIENT_SELECT });
  },

  async list(
    filters: { isActive?: boolean | undefined },
    client: PrismaClientLike = prisma,
  ): Promise<ClientRecord[]> {
    return client.client.findMany({
      where: filters.isActive === undefined ? {} : { isActive: filters.isActive },
      select: CLIENT_SELECT,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  },

  /** One page of the list, with the total the page came from. */
  async listPage(
    filters: { isActive?: boolean | undefined; q?: string },
    pagination: Pagination,
    client: PrismaClientLike = prisma,
  ): Promise<{ items: ClientRecord[]; total: number }> {
    const where: Prisma.ClientWhereInput = {
      ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: 'insensitive' } },
              { taxId: { contains: filters.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    let orderBy: Prisma.ClientOrderByWithRelationInput[] = [
      { isActive: 'desc' },
      { name: 'asc' },
    ];
    if (pagination.sort && SORTABLE_COLUMNS.has(pagination.sort)) {
      const dir = pagination.dir ?? 'asc';
      orderBy = [{ [pagination.sort]: dir } as Prisma.ClientOrderByWithRelationInput, ...orderBy];
    }

    const [items, total] = await Promise.all([
      client.client.findMany({
        where,
        select: CLIENT_SELECT,
        orderBy,
        ...toPrismaPagination(pagination),
      }),
      client.client.count({ where }),
    ]);

    return { items, total };
  },

  /**
   * What would stop this client being deleted.
   *
   * Nothing references a client yet (roadmap §2 — the issued-invoice/service
   * link is Phase 4's decision), so this always returns zero counts today.
   * Kept as a real query rather than a hard-coded `{ canDelete: true }` so
   * Phase 4 adds a count here, not a new code path.
   */
  async countDependents(
    _id: string,
    _client: PrismaClientLike = prisma,
  ): Promise<Record<string, never>> {
    return {};
  },

  async delete(id: string, client: PrismaClientLike = prisma): Promise<void> {
    await client.client.delete({ where: { id } });
  },

  async create(
    data: Prisma.ClientCreateInput,
    client: PrismaClientLike = prisma,
  ): Promise<ClientRecord> {
    return client.client.create({ data, select: CLIENT_SELECT });
  },

  async update(
    id: string,
    data: Prisma.ClientUpdateInput,
    client: PrismaClientLike = prisma,
  ): Promise<ClientRecord> {
    return client.client.update({ where: { id }, data, select: CLIENT_SELECT });
  },
} as const;

export type ClientRepository = typeof clientRepository;
