/**
 * Database access for issued invoices (ERP roadmap Phase 4).
 */
import type { Prisma } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';
import type { Pagination } from '@/modules/shared/schemas/common';
import { toPrismaPagination } from '@/modules/shared/schemas/common';

const ISSUED_INVOICE_INCLUDE = {
  client: { select: { id: true, name: true } },
  state: { select: { id: true, name: true } },
  services: {
    select: {
      id: true,
      serviceCode: true,
      serviceDate: true,
      baseCents: true,
      route: { select: { code: true, name: true } },
    },
  },
} satisfies Prisma.IssuedInvoiceInclude;

export type IssuedInvoiceWithRelations = Prisma.IssuedInvoiceGetPayload<{
  include: typeof ISSUED_INVOICE_INCLUDE;
}>;

/** A billable service, as the invoice-creation picker needs it. */
const BILLABLE_SERVICE_SELECT = {
  id: true,
  serviceCode: true,
  serviceDate: true,
  baseCents: true,
  route: { select: { code: true, name: true } },
} satisfies Prisma.ServiceSelect;

export type BillableService = Prisma.ServiceGetPayload<{ select: typeof BILLABLE_SERVICE_SELECT }>;

const ISSUED_INVOICE_CODE_SEQUENCE = 'issued_invoice_code_seq';

export const issuedInvoiceRepository = {
  async findById(
    id: string,
    client: PrismaClientLike = prisma,
  ): Promise<IssuedInvoiceWithRelations | null> {
    return client.issuedInvoice.findUnique({ where: { id }, include: ISSUED_INVOICE_INCLUDE });
  },

  async listPage(
    filters: { clientId?: string },
    pagination: Pagination,
    client: PrismaClientLike = prisma,
  ): Promise<{ items: IssuedInvoiceWithRelations[]; total: number }> {
    const where: Prisma.IssuedInvoiceWhereInput = {
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
    };

    const [items, total] = await Promise.all([
      client.issuedInvoice.findMany({
        where,
        include: ISSUED_INVOICE_INCLUDE,
        orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
        ...toPrismaPagination(pagination),
      }),
      client.issuedInvoice.count({ where }),
    ]);

    return { items, total };
  },

  /**
   * Approved, priced, not-yet-invoiced services on this client's routes —
   * the picker `issuedInvoiceService.create` validates its `serviceIds`
   * against, and what `/admin/issued-invoices/new` renders as checkboxes.
   * "This client's routes" rather than "this client" directly: a service
   * never names a client itself (ERP roadmap Phase 4, roadmap §6 B4 -
   * "Contrato = Route" - see the doc comment on `Route.clientId`).
   */
  async billableServicesForClient(
    clientId: string,
    client: PrismaClientLike = prisma,
  ): Promise<BillableService[]> {
    return client.service.findMany({
      where: {
        route: { clientId },
        status: 'APPROVED',
        baseCents: { not: null },
        issuedInvoiceId: null,
      },
      select: BILLABLE_SERVICE_SELECT,
      orderBy: { serviceDate: 'asc' },
    });
  },

  /** Every invoice's date and VAT, for `taxService`'s quarterly summary
   * (roadmap's "IVA repercutido") — same reasoning as `receivedInvoiceRepository.allForTaxSummary`. */
  async allForTaxSummary(
    client: PrismaClientLike = prisma,
  ): Promise<{ invoiceDate: Date; vatCents: number }[]> {
    return client.issuedInvoice.findMany({ select: { invoiceDate: true, vatCents: true } });
  },

  async nextInvoiceSequence(client: PrismaClientLike = prisma): Promise<bigint> {
    const rows = await client.$queryRawUnsafe<{ value: bigint }[]>(
      `SELECT nextval('${ISSUED_INVOICE_CODE_SEQUENCE}') AS value`,
    );

    const value = rows[0]?.value;
    if (value === undefined) {
      throw new Error(`Sequence "${ISSUED_INVOICE_CODE_SEQUENCE}" returned no value.`);
    }
    return value;
  },

  async create(
    data: Prisma.IssuedInvoiceUncheckedCreateInput,
    client: PrismaClientLike = prisma,
  ): Promise<IssuedInvoiceWithRelations> {
    return client.issuedInvoice.create({ data, include: ISSUED_INVOICE_INCLUDE });
  },

  /** Links a batch of services to this invoice - `issuedInvoiceService.create`'s other write, in the same transaction. */
  async linkServices(
    invoiceId: string,
    serviceIds: string[],
    client: PrismaClientLike = prisma,
  ): Promise<void> {
    await client.service.updateMany({
      where: { id: { in: serviceIds } },
      data: { issuedInvoiceId: invoiceId },
    });
  },

  async update(
    id: string,
    data: Prisma.IssuedInvoiceUncheckedUpdateInput,
    client: PrismaClientLike = prisma,
  ): Promise<IssuedInvoiceWithRelations> {
    return client.issuedInvoice.update({
      where: { id },
      data,
      include: ISSUED_INVOICE_INCLUDE,
    });
  },

  /**
   * Deletes the invoice. Every service it grouped is un-billed automatically
   * by the database - `services_issued_invoice_id_fkey` is declared
   * `ON DELETE SET NULL` (see the doc comment on `Service.issuedInvoiceId`
   * in `schema.prisma`), so no separate unlinking query is needed here.
   */
  async delete(id: string, client: PrismaClientLike = prisma): Promise<void> {
    await client.issuedInvoice.delete({ where: { id } });
  },
} as const;

export type IssuedInvoiceRepository = typeof issuedInvoiceRepository;
export { ISSUED_INVOICE_CODE_SEQUENCE };
