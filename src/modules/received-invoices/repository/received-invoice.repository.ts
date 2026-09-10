/**
 * Database access for received invoices (ERP roadmap Phase 3).
 */
import type { Prisma } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';
import type { Pagination } from '@/modules/shared/schemas/common';
import { toPrismaPagination } from '@/modules/shared/schemas/common';

const RECEIVED_INVOICE_INCLUDE = {
  supplier: { select: { id: true, name: true } },
  category: { select: { id: true, name: true, expenseType: true } },
  vehicle: { select: { id: true, registrationPlate: true, referenceName: true } },
  state: { select: { id: true, name: true } },
  paymentMethod: { select: { id: true, name: true } },
} satisfies Prisma.ReceivedInvoiceInclude;

export type ReceivedInvoiceWithRelations = Prisma.ReceivedInvoiceGetPayload<{
  include: typeof RECEIVED_INVOICE_INCLUDE;
}>;

const RECEIVED_INVOICE_CODE_SEQUENCE = 'received_invoice_code_seq';

export const receivedInvoiceRepository = {
  async findById(
    id: string,
    client: PrismaClientLike = prisma,
  ): Promise<ReceivedInvoiceWithRelations | null> {
    return client.receivedInvoice.findUnique({
      where: { id },
      include: RECEIVED_INVOICE_INCLUDE,
    });
  },

  async listPage(
    filters: { vehicleId?: string; supplierId?: string; categoryId?: string },
    pagination: Pagination,
    client: PrismaClientLike = prisma,
  ): Promise<{ items: ReceivedInvoiceWithRelations[]; total: number }> {
    const where: Prisma.ReceivedInvoiceWhereInput = {
      ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
      ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    };

    const [items, total] = await Promise.all([
      client.receivedInvoice.findMany({
        where,
        include: RECEIVED_INVOICE_INCLUDE,
        orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
        ...toPrismaPagination(pagination),
      }),
      client.receivedInvoice.count({ where }),
    ]);

    return { items, total };
  },

  /**
   * Total invested per vehicle (`07_Inversiones`'s "Total inversión =
   * SUMIFS(..., Tipo='Inversión')"), restricted to invoices whose category
   * is `INVESTMENT` and that name a vehicle. Grouped in the database rather
   * than in application code - the roadmap's own framing of `07_Inversiones`
   * as a "view" (§4, Phase 3 row) is exactly this: an aggregate query, not a
   * stored table.
   */
  async investmentTotalsByVehicle(
    client: PrismaClientLike = prisma,
  ): Promise<{ vehicleId: string; totalCents: number; invoiceCount: number }[]> {
    const rows = await client.receivedInvoice.groupBy({
      by: ['vehicleId'],
      where: { vehicleId: { not: null }, category: { expenseType: 'INVESTMENT' } },
      _sum: { totalCents: true },
      _count: { _all: true },
    });

    return rows
      .filter((row): row is typeof row & { vehicleId: string } => row.vehicleId !== null)
      .map((row) => ({
        vehicleId: row.vehicleId,
        totalCents: row._sum.totalCents ?? 0,
        invoiceCount: row._count._all,
      }));
  },

  /**
   * Every invoice's date and VAT, for `taxService`'s quarterly summary
   * (ERP roadmap Phase 4, `06_Impuestos`'s "IVA soportado"). Grouping by
   * fiscal period happens in `taxService`, via the Phase 1
   * `fiscalPeriodFromParts` domain helper - not here, and not in raw SQL -
   * so the same pure function derives "which quarter" everywhere it matters.
   */
  async allForTaxSummary(
    client: PrismaClientLike = prisma,
  ): Promise<{ invoiceDate: Date; vatCents: number }[]> {
    return client.receivedInvoice.findMany({ select: { invoiceDate: true, vatCents: true } });
  },

  async nextInvoiceSequence(client: PrismaClientLike = prisma): Promise<bigint> {
    const rows = await client.$queryRawUnsafe<{ value: bigint }[]>(
      `SELECT nextval('${RECEIVED_INVOICE_CODE_SEQUENCE}') AS value`,
    );

    const value = rows[0]?.value;
    if (value === undefined) {
      throw new Error(`Sequence "${RECEIVED_INVOICE_CODE_SEQUENCE}" returned no value.`);
    }
    return value;
  },

  async create(
    data: Prisma.ReceivedInvoiceUncheckedCreateInput,
    client: PrismaClientLike = prisma,
  ): Promise<ReceivedInvoiceWithRelations> {
    return client.receivedInvoice.create({ data, include: RECEIVED_INVOICE_INCLUDE });
  },

  async update(
    id: string,
    data: Prisma.ReceivedInvoiceUncheckedUpdateInput,
    client: PrismaClientLike = prisma,
  ): Promise<ReceivedInvoiceWithRelations> {
    return client.receivedInvoice.update({
      where: { id },
      data,
      include: RECEIVED_INVOICE_INCLUDE,
    });
  },

  async delete(id: string, client: PrismaClientLike = prisma): Promise<void> {
    await client.receivedInvoice.delete({ where: { id } });
  },
} as const;

export type ReceivedInvoiceRepository = typeof receivedInvoiceRepository;
export { RECEIVED_INVOICE_CODE_SEQUENCE };
