/**
 * Database access for simple lookup lists (ERP roadmap Phase 1).
 *
 * One table, `kind`-scoped throughout: every query here takes a `kind` and
 * filters or writes only within it, so a caller can never read or edit an
 * item from a different list by accident — the same isolation four separate
 * tables would give, without four repositories to keep in step.
 */
import type { LookupKind, Prisma } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';
import type { Pagination } from '@/modules/shared/schemas/common';
import { toPrismaPagination } from '@/modules/shared/schemas/common';

export type { LookupKind };

const LOOKUP_SELECT = {
  id: true,
  kind: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LookupItemSelect;

export type LookupItemRecord = Prisma.LookupItemGetPayload<{ select: typeof LOOKUP_SELECT }>;

export const lookupRepository = {
  /** Scoped to `kind` — an id from another list simply is not found. */
  async findById(
    kind: LookupKind,
    id: string,
    client: PrismaClientLike = prisma,
  ): Promise<LookupItemRecord | null> {
    return client.lookupItem.findFirst({ where: { id, kind }, select: LOOKUP_SELECT });
  },

  async list(
    kind: LookupKind,
    filters: { isActive?: boolean | undefined },
    client: PrismaClientLike = prisma,
  ): Promise<LookupItemRecord[]> {
    return client.lookupItem.findMany({
      where: { kind, ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }) },
      select: LOOKUP_SELECT,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  },

  async listPage(
    kind: LookupKind,
    filters: { isActive?: boolean | undefined; q?: string },
    pagination: Pagination,
    client: PrismaClientLike = prisma,
  ): Promise<{ items: LookupItemRecord[]; total: number }> {
    const where: Prisma.LookupItemWhereInput = {
      kind,
      ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }),
      ...(filters.q ? { name: { contains: filters.q, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await Promise.all([
      client.lookupItem.findMany({
        where,
        select: LOOKUP_SELECT,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        ...toPrismaPagination(pagination),
      }),
      client.lookupItem.count({ where }),
    ]);

    return { items, total };
  },

  /**
   * What would stop this item being deleted.
   *
   * `refuellings` may reference a `LookupItem` through three different
   * columns (fuel type, gas station, payment method — ERP roadmap Phase 2);
   * `receivedInvoices` through two more (state, payment method — Phase 3);
   * `services` (supplement type) and `issuedInvoices` (state) each through
   * one more (Phase 4); `maintenanceRecords` (maintenance type) through one
   * more again (Phase 5). An item is blocked if it is used through *any* of
   * a family's columns, so each family's counts are summed into one blocker
   * `toDeletability` expects, rather than eight separate kinds an
   * administrator would have to mentally add up.
   */
  async countDependents(
    // Unused: an item's id only ever appears in the FK columns matching its
    // own kind, so no branch on `kind` is needed to count correctly — kept
    // as a parameter for signature parity with this repository's other
    // `kind`-scoped methods.
    _kind: LookupKind,
    id: string,
    client: PrismaClientLike = prisma,
  ): Promise<{
    refuellings: number;
    receivedInvoices: number;
    services: number;
    issuedInvoices: number;
    maintenanceRecords: number;
  }> {
    const [
      asFuelType,
      asGasStation,
      asRefuellingPaymentMethod,
      asReceivedInvoiceState,
      asReceivedInvoicePaymentMethod,
      asSupplementType,
      asIssuedInvoiceState,
      asMaintenanceType,
    ] = await Promise.all([
      client.refuelling.count({ where: { fuelTypeId: id } }),
      client.refuelling.count({ where: { gasStationId: id } }),
      client.refuelling.count({ where: { paymentMethodId: id } }),
      client.receivedInvoice.count({ where: { stateId: id } }),
      client.receivedInvoice.count({ where: { paymentMethodId: id } }),
      client.service.count({ where: { supplementTypeId: id } }),
      client.issuedInvoice.count({ where: { stateId: id } }),
      client.maintenanceRecord.count({ where: { maintenanceTypeId: id } }),
    ]);

    return {
      refuellings: asFuelType + asGasStation + asRefuellingPaymentMethod,
      receivedInvoices: asReceivedInvoiceState + asReceivedInvoicePaymentMethod,
      services: asSupplementType,
      issuedInvoices: asIssuedInvoiceState,
      maintenanceRecords: asMaintenanceType,
    };
  },

  async delete(kind: LookupKind, id: string, client: PrismaClientLike = prisma): Promise<void> {
    // `deleteMany` rather than `delete` so the `kind` scope is enforced by
    // the query itself, not by a check the caller must remember to run
    // first — a stray id from another list matches zero rows, not someone
    // else's.
    await client.lookupItem.deleteMany({ where: { id, kind } });
  },

  async create(
    kind: LookupKind,
    data: { name: string; isActive: boolean },
    client: PrismaClientLike = prisma,
  ): Promise<LookupItemRecord> {
    return client.lookupItem.create({ data: { kind, ...data }, select: LOOKUP_SELECT });
  },

  async update(
    kind: LookupKind,
    id: string,
    data: Prisma.LookupItemUpdateInput,
    client: PrismaClientLike = prisma,
  ): Promise<LookupItemRecord> {
    // `updateMany` for the same `kind`-scoping reason as `delete`, then a
    // re-read: `updateMany` does not return the row, and the caller (the
    // service layer) already re-fetched `existing` before this is called, so
    // an item that vanished between the two would already have 404'd there.
    await client.lookupItem.updateMany({ where: { id, kind }, data });
    return client.lookupItem.findFirstOrThrow({ where: { id, kind }, select: LOOKUP_SELECT });
  },
} as const;

export type LookupRepository = typeof lookupRepository;
