/**
 * Received-invoice administration (ERP roadmap Phase 3). Admin-only end to
 * end, mirroring `refuelling.service.ts`'s structure — see that file and
 * ADR 0013/0014 for the shared reasoning this restates only where it differs.
 */
import type { LookupKind } from '@prisma/client';

import {
  AuditAction,
  AuditEntityType,
  diffForAudit,
  writeAudit,
} from '@/lib/audit/audit-service';
import type { Actor } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { withTranslatedErrors } from '@/lib/db/with-translated-errors';
import { businessRuleViolation, forbidden, notFound } from '@/lib/errors/app-error';
import { ERRORS } from '@/lib/i18n/messages';
import { formatDocumentCode } from '@/modules/shared/domain/document-sequence';
import { applyVat, type VatRate } from '@/modules/shared/domain/vat';
import type { Pagination } from '@/modules/shared/schemas/common';
import { expenseCategoryRepository } from '@/modules/expense-categories/repository/expense-category.repository';
import { lookupRepository } from '@/modules/lookup/repository/lookup.repository';
import { Role } from '@/modules/services/domain/service-status';
import { supplierRepository } from '@/modules/suppliers/repository/supplier.repository';
import { vehicleRepository } from '@/modules/vehicles/repository/vehicle.repository';
import {
  receivedInvoiceRepository,
  type ReceivedInvoiceWithRelations,
} from '../repository/received-invoice.repository';
import type {
  CreateReceivedInvoiceInput,
  UpdateReceivedInvoiceInput,
} from '../schemas/received-invoice.schema';

function assertAdmin(actor: Actor): void {
  if (actor.role !== Role.ADMIN) throw forbidden();
}

/** One row of the investment summary — a vehicle and what has gone into it. */
export interface VehicleInvestmentTotal {
  vehicle: { id: string; registrationPlate: string; referenceName: string | null };
  totalCents: number;
  invoiceCount: number;
}

async function assertActiveSupplier(supplierId: string): Promise<void> {
  const supplier = await supplierRepository.findById(supplierId);
  if (!supplier) throw notFound();
  if (!supplier.isActive) throw businessRuleViolation(ERRORS.supplierInactive);
}

async function assertActiveCategory(categoryId: string): Promise<void> {
  const category = await expenseCategoryRepository.findById(categoryId);
  if (!category) throw notFound();
  if (!category.isActive) throw businessRuleViolation(ERRORS.categoryInactive);
}

async function assertActiveVehicle(vehicleId: string | undefined): Promise<void> {
  if (vehicleId === undefined) return;
  const vehicle = await vehicleRepository.findById(vehicleId);
  if (!vehicle) throw notFound();
  if (!vehicle.isActive) throw businessRuleViolation(ERRORS.vehicleInactive);
}

/** Same polymorphic-reference check as `refuellingService`'s — see there. */
async function assertLookupKind(id: string | undefined, kind: LookupKind): Promise<void> {
  if (id === undefined) return;
  const item = await lookupRepository.findById(kind, id);
  if (!item) throw businessRuleViolation(ERRORS.lookupKindMismatch);
}

export const receivedInvoiceService = {
  async listPage(
    actor: Actor,
    filters: { vehicleId?: string; supplierId?: string; categoryId?: string },
    pagination: Pagination,
  ): Promise<{ items: ReceivedInvoiceWithRelations[]; total: number }> {
    assertAdmin(actor);
    return receivedInvoiceRepository.listPage(filters, pagination);
  },

  async getById(actor: Actor, id: string): Promise<ReceivedInvoiceWithRelations> {
    assertAdmin(actor);
    const found = await receivedInvoiceRepository.findById(id);
    if (!found) throw notFound();
    return found;
  },

  /**
   * `07_Inversiones`'s "Total inversión per vehicle" (roadmap §4, Phase 3
   * row) — a live aggregate over `receivedInvoiceRepository
   * .investmentTotalsByVehicle`, joined here with the vehicle records that
   * query only returns ids for. What the roadmap defers past this phase —
   * recovery against accumulated profit — needs revenue and every other
   * cost source aggregated too, which is Phase 6's analytics layer, not
   * this one (ADR 0014).
   */
  async investmentSummary(actor: Actor): Promise<VehicleInvestmentTotal[]> {
    assertAdmin(actor);

    const totals = await receivedInvoiceRepository.investmentTotalsByVehicle();
    if (totals.length === 0) return [];

    const vehicles = await vehicleRepository.list({});
    const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

    return totals
      .map((total) => {
        const vehicle = vehicleById.get(total.vehicleId);
        if (!vehicle) return null;
        return {
          vehicle: {
            id: vehicle.id,
            registrationPlate: vehicle.registrationPlate,
            referenceName: vehicle.referenceName,
          },
          totalCents: total.totalCents,
          invoiceCount: total.invoiceCount,
        };
      })
      .filter((row): row is VehicleInvestmentTotal => row !== null)
      .sort((a, b) => b.totalCents - a.totalCents);
  },

  async create(
    actor: Actor,
    input: CreateReceivedInvoiceInput,
  ): Promise<ReceivedInvoiceWithRelations> {
    assertAdmin(actor);

    await assertActiveSupplier(input.supplierId);
    await assertActiveCategory(input.categoryId);
    await assertActiveVehicle(input.vehicleId);
    await assertLookupKind(input.stateId, 'INVOICE_STATE');
    await assertLookupKind(input.paymentMethodId, 'PAYMENT_METHOD');

    // Forward direction, unlike Refuelling: the invoice states its base, so
    // the total is derived from it via `applyVat`, not the other way round
    // (see the doc comment on `ReceivedInvoice` in `schema.prisma`).
    const { vatCents, totalCents } = applyVat(input.base, input.vatRate as VatRate);

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const sequence = await receivedInvoiceRepository.nextInvoiceSequence(tx);

        const created = await receivedInvoiceRepository.create(
          {
            invoiceCode: formatDocumentCode('FR', 6, sequence),
            supplierId: input.supplierId,
            categoryId: input.categoryId,
            vehicleId: input.vehicleId ?? null,
            invoiceDate: new Date(`${input.invoiceDate}T00:00:00.000Z`),
            baseCents: input.base,
            vatRate: input.vatRate,
            vatCents,
            totalCents,
            stateId: input.stateId ?? null,
            paymentMethodId: input.paymentMethodId ?? null,
            notes: input.notes ?? null,
          },
          tx,
        );

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.RECEIVED_INVOICE,
          entityId: created.id,
          action: AuditAction.CREATE,
          after: created,
        });

        return created;
      }),
    );
  },

  async update(
    actor: Actor,
    id: string,
    input: UpdateReceivedInvoiceInput,
  ): Promise<ReceivedInvoiceWithRelations> {
    assertAdmin(actor);

    const existing = await receivedInvoiceRepository.findById(id);
    if (!existing) throw notFound();

    if (input.supplierId !== undefined) await assertActiveSupplier(input.supplierId);
    if (input.categoryId !== undefined) await assertActiveCategory(input.categoryId);
    if (input.vehicleId !== undefined) await assertActiveVehicle(input.vehicleId);
    await assertLookupKind(input.stateId, 'INVOICE_STATE');
    await assertLookupKind(input.paymentMethodId, 'PAYMENT_METHOD');

    const nextBase = input.base ?? existing.baseCents;
    const nextRate = (input.vatRate ?? existing.vatRate) as VatRate;
    const recalculate = input.base !== undefined || input.vatRate !== undefined;
    const split = recalculate ? applyVat(nextBase, nextRate) : null;

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const updated = await receivedInvoiceRepository.update(
          id,
          {
            ...(input.supplierId === undefined ? {} : { supplierId: input.supplierId }),
            ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
            ...(input.vehicleId === undefined ? {} : { vehicleId: input.vehicleId ?? null }),
            ...(input.invoiceDate === undefined
              ? {}
              : { invoiceDate: new Date(`${input.invoiceDate}T00:00:00.000Z`) }),
            ...(input.base === undefined ? {} : { baseCents: input.base }),
            ...(input.vatRate === undefined ? {} : { vatRate: input.vatRate }),
            ...(split ? { vatCents: split.vatCents, totalCents: split.totalCents } : {}),
            ...(input.stateId === undefined ? {} : { stateId: input.stateId ?? null }),
            ...(input.paymentMethodId === undefined
              ? {}
              : { paymentMethodId: input.paymentMethodId ?? null }),
            ...(input.notes === undefined ? {} : { notes: input.notes ?? null }),
          },
          tx,
        );

        const changes = diffForAudit(
          existing as unknown as Record<string, unknown>,
          input as Record<string, unknown>,
        );

        if (changes) {
          await writeAudit(tx, {
            actorUserId: actor.userId,
            entityType: AuditEntityType.RECEIVED_INVOICE,
            entityId: id,
            action: AuditAction.UPDATE,
            before: changes.before,
            after: changes.after,
          });
        }

        return updated;
      }),
    );
  },

  async remove(actor: Actor, id: string): Promise<void> {
    assertAdmin(actor);

    const existing = await receivedInvoiceRepository.findById(id);
    if (!existing) throw notFound();

    await withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.RECEIVED_INVOICE,
          entityId: id,
          action: AuditAction.DELETE,
          before: existing,
        });

        await receivedInvoiceRepository.delete(id, tx);
      }),
    );
  },
} as const;
