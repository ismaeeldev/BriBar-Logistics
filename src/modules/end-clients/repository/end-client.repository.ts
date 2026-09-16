/**
 * Database access for end clients ("Cliente final", client change request
 * 2026-09-17). Mirrors `client.repository.ts` — same shape as `Client`
 * deliberately, see the model's doc comment in `schema.prisma`.
 */
import type { Prisma } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';
import type { Pagination } from '@/modules/shared/schemas/common';
import { toPrismaPagination } from '@/modules/shared/schemas/common';

const END_CLIENT_SELECT = {
  id: true,
  name: true,
  taxId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EndClientSelect;

export type EndClientRecord = Prisma.EndClientGetPayload<{ select: typeof END_CLIENT_SELECT }>;

const SORTABLE_COLUMNS = new Set(['name', 'isActive']);

export const endClientRepository = {
  async findById(
    id: string,
    client: PrismaClientLike = prisma,
  ): Promise<EndClientRecord | null> {
    return client.endClient.findUnique({ where: { id }, select: END_CLIENT_SELECT });
  },

  async list(
    filters: { isActive?: boolean | undefined },
    client: PrismaClientLike = prisma,
  ): Promise<EndClientRecord[]> {
    return client.endClient.findMany({
      where: filters.isActive === undefined ? {} : { isActive: filters.isActive },
      select: END_CLIENT_SELECT,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  },

  /** One page of the list, with the total the page came from. */
  async listPage(
    filters: { isActive?: boolean | undefined; q?: string },
    pagination: Pagination,
    client: PrismaClientLike = prisma,
  ): Promise<{ items: EndClientRecord[]; total: number }> {
    const where: Prisma.EndClientWhereInput = {
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

    let orderBy: Prisma.EndClientOrderByWithRelationInput[] = [
      { isActive: 'desc' },
      { name: 'asc' },
    ];
    if (pagination.sort && SORTABLE_COLUMNS.has(pagination.sort)) {
      const dir = pagination.dir ?? 'asc';
      orderBy = [
        { [pagination.sort]: dir } as Prisma.EndClientOrderByWithRelationInput,
        ...orderBy,
      ];
    }

    const [items, total] = await Promise.all([
      client.endClient.findMany({
        where,
        select: END_CLIENT_SELECT,
        orderBy,
        ...toPrismaPagination(pagination),
      }),
      client.endClient.count({ where }),
    ]);

    return { items, total };
  },

  /**
   * What would stop this end client being deleted.
   *
   * Unlike `Client`, nothing else ever references an `EndClient` — only
   * `Route.endClientId`.
   */
  async countDependents(
    id: string,
    client: PrismaClientLike = prisma,
  ): Promise<{ routes: number }> {
    const routes = await client.route.count({ where: { endClientId: id } });
    return { routes };
  },

  async delete(id: string, client: PrismaClientLike = prisma): Promise<void> {
    await client.endClient.delete({ where: { id } });
  },

  async create(
    data: Prisma.EndClientCreateInput,
    client: PrismaClientLike = prisma,
  ): Promise<EndClientRecord> {
    return client.endClient.create({ data, select: END_CLIENT_SELECT });
  },

  async update(
    id: string,
    data: Prisma.EndClientUpdateInput,
    client: PrismaClientLike = prisma,
  ): Promise<EndClientRecord> {
    return client.endClient.update({ where: { id }, data, select: END_CLIENT_SELECT });
  },
} as const;

export type EndClientRepository = typeof endClientRepository;
