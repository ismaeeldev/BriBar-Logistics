/**
 * Database access for suppliers (ERP roadmap Phase 3).
 */
import type { Prisma } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';
import type { Pagination } from '@/modules/shared/schemas/common';
import { toPrismaPagination } from '@/modules/shared/schemas/common';

const SUPPLIER_SELECT = {
  id: true,
  name: true,
  taxId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SupplierSelect;

export type SupplierRecord = Prisma.SupplierGetPayload<{ select: typeof SUPPLIER_SELECT }>;

const SORTABLE_COLUMNS = new Set(['name', 'isActive']);

export const supplierRepository = {
  async findById(id: string, client: PrismaClientLike = prisma): Promise<SupplierRecord | null> {
    return client.supplier.findUnique({ where: { id }, select: SUPPLIER_SELECT });
  },

  async list(
    filters: { isActive?: boolean | undefined },
    client: PrismaClientLike = prisma,
  ): Promise<SupplierRecord[]> {
    return client.supplier.findMany({
      where: filters.isActive === undefined ? {} : { isActive: filters.isActive },
      select: SUPPLIER_SELECT,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  },

  /** One page of the list, with the total the page came from. */
  async listPage(
    filters: { isActive?: boolean | undefined; q?: string },
    pagination: Pagination,
    client: PrismaClientLike = prisma,
  ): Promise<{ items: SupplierRecord[]; total: number }> {
    const where: Prisma.SupplierWhereInput = {
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

    let orderBy: Prisma.SupplierOrderByWithRelationInput[] = [
      { isActive: 'desc' },
      { name: 'asc' },
    ];
    if (pagination.sort && SORTABLE_COLUMNS.has(pagination.sort)) {
      const dir = pagination.dir ?? 'asc';
      orderBy = [
        { [pagination.sort]: dir } as Prisma.SupplierOrderByWithRelationInput,
        ...orderBy,
      ];
    }

    const [items, total] = await Promise.all([
      client.supplier.findMany({
        where,
        select: SUPPLIER_SELECT,
        orderBy,
        ...toPrismaPagination(pagination),
      }),
      client.supplier.count({ where }),
    ]);

    return { items, total };
  },

  /**
   * What would stop this supplier being deleted — unlike `Client`
   * (still unreferenced, ADR 0012), a `Supplier` is this phase's own
   * `ReceivedInvoice.supplierId`, so this is a real count from the start.
   */
  async countDependents(
    id: string,
    client: PrismaClientLike = prisma,
  ): Promise<{ receivedInvoices: number }> {
    const receivedInvoices = await client.receivedInvoice.count({ where: { supplierId: id } });
    return { receivedInvoices };
  },

  async delete(id: string, client: PrismaClientLike = prisma): Promise<void> {
    await client.supplier.delete({ where: { id } });
  },

  async create(
    data: Prisma.SupplierCreateInput,
    client: PrismaClientLike = prisma,
  ): Promise<SupplierRecord> {
    return client.supplier.create({ data, select: SUPPLIER_SELECT });
  },

  async update(
    id: string,
    data: Prisma.SupplierUpdateInput,
    client: PrismaClientLike = prisma,
  ): Promise<SupplierRecord> {
    return client.supplier.update({ where: { id }, data, select: SUPPLIER_SELECT });
  },
} as const;

export type SupplierRepository = typeof supplierRepository;
