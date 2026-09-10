/**
 * Database access for expense categories (ERP roadmap Phase 3).
 */
import type { Prisma } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';
import type { Pagination } from '@/modules/shared/schemas/common';
import { toPrismaPagination } from '@/modules/shared/schemas/common';

const EXPENSE_CATEGORY_SELECT = {
  id: true,
  name: true,
  expenseType: true,
  defaultVatRate: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ExpenseCategorySelect;

export type ExpenseCategoryRecord = Prisma.ExpenseCategoryGetPayload<{
  select: typeof EXPENSE_CATEGORY_SELECT;
}>;

const SORTABLE_COLUMNS = new Set(['name', 'expenseType', 'isActive']);

export const expenseCategoryRepository = {
  async findById(
    id: string,
    client: PrismaClientLike = prisma,
  ): Promise<ExpenseCategoryRecord | null> {
    return client.expenseCategory.findUnique({ where: { id }, select: EXPENSE_CATEGORY_SELECT });
  },

  async list(
    filters: { isActive?: boolean | undefined },
    client: PrismaClientLike = prisma,
  ): Promise<ExpenseCategoryRecord[]> {
    return client.expenseCategory.findMany({
      where: filters.isActive === undefined ? {} : { isActive: filters.isActive },
      select: EXPENSE_CATEGORY_SELECT,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  },

  async listPage(
    filters: { isActive?: boolean | undefined; q?: string },
    pagination: Pagination,
    client: PrismaClientLike = prisma,
  ): Promise<{ items: ExpenseCategoryRecord[]; total: number }> {
    const where: Prisma.ExpenseCategoryWhereInput = {
      ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }),
      ...(filters.q ? { name: { contains: filters.q, mode: 'insensitive' } } : {}),
    };

    let orderBy: Prisma.ExpenseCategoryOrderByWithRelationInput[] = [
      { isActive: 'desc' },
      { name: 'asc' },
    ];
    if (pagination.sort && SORTABLE_COLUMNS.has(pagination.sort)) {
      const dir = pagination.dir ?? 'asc';
      orderBy = [
        { [pagination.sort]: dir } as Prisma.ExpenseCategoryOrderByWithRelationInput,
        ...orderBy,
      ];
    }

    const [items, total] = await Promise.all([
      client.expenseCategory.findMany({
        where,
        select: EXPENSE_CATEGORY_SELECT,
        orderBy,
        ...toPrismaPagination(pagination),
      }),
      client.expenseCategory.count({ where }),
    ]);

    return { items, total };
  },

  async countDependents(
    id: string,
    client: PrismaClientLike = prisma,
  ): Promise<{ receivedInvoices: number }> {
    const receivedInvoices = await client.receivedInvoice.count({ where: { categoryId: id } });
    return { receivedInvoices };
  },

  async delete(id: string, client: PrismaClientLike = prisma): Promise<void> {
    await client.expenseCategory.delete({ where: { id } });
  },

  async create(
    data: Prisma.ExpenseCategoryCreateInput,
    client: PrismaClientLike = prisma,
  ): Promise<ExpenseCategoryRecord> {
    return client.expenseCategory.create({ data, select: EXPENSE_CATEGORY_SELECT });
  },

  async update(
    id: string,
    data: Prisma.ExpenseCategoryUpdateInput,
    client: PrismaClientLike = prisma,
  ): Promise<ExpenseCategoryRecord> {
    return client.expenseCategory.update({
      where: { id },
      data,
      select: EXPENSE_CATEGORY_SELECT,
    });
  },
} as const;

export type ExpenseCategoryRepository = typeof expenseCategoryRepository;
