/**
 * Supplier administration (ERP roadmap Phase 3). Admin-only end to end.
 */
import type { Deletability } from '@/modules/shared/deletability';
import { toDeletability } from '@/modules/shared/deletability';
import type { Pagination } from '@/modules/shared/schemas/common';
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
import { Role } from '@/modules/services/domain/service-status';
import { supplierRepository, type SupplierRecord } from '../repository/supplier.repository';
import type { CreateSupplierInput, UpdateSupplierInput } from '../schemas/supplier.schema';

function assertAdmin(actor: Actor): void {
  if (actor.role !== Role.ADMIN) throw forbidden();
}

export const supplierService = {
  async list(
    actor: Actor,
    filters: { isActive?: boolean | undefined } = {},
  ): Promise<SupplierRecord[]> {
    assertAdmin(actor);
    return supplierRepository.list(filters);
  },

  async listPage(
    actor: Actor,
    filters: { isActive?: boolean | undefined; q?: string },
    pagination: Pagination,
  ): Promise<{ items: SupplierRecord[]; total: number }> {
    assertAdmin(actor);
    return supplierRepository.listPage(filters, pagination);
  },

  async getById(actor: Actor, id: string): Promise<SupplierRecord> {
    assertAdmin(actor);
    const found = await supplierRepository.findById(id);
    if (!found) throw notFound();
    return found;
  },

  async getDeletability(actor: Actor, id: string): Promise<Deletability> {
    assertAdmin(actor);
    const counts = await supplierRepository.countDependents(id);
    return toDeletability(counts);
  },

  async remove(actor: Actor, id: string): Promise<void> {
    assertAdmin(actor);

    const existing = await supplierRepository.findById(id);
    if (!existing) throw notFound();

    await withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const counts = await supplierRepository.countDependents(id, tx);
        if (!toDeletability(counts).canDelete) {
          throw businessRuleViolation(ERRORS.deleteBlocked);
        }

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.SUPPLIER,
          entityId: id,
          action: AuditAction.DELETE,
          before: existing,
        });

        await supplierRepository.delete(id, tx);
      }),
    );
  },

  async create(actor: Actor, input: CreateSupplierInput): Promise<SupplierRecord> {
    assertAdmin(actor);

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const created = await supplierRepository.create(
          {
            name: input.name,
            taxId: input.taxId ?? null,
            isActive: input.isActive,
          },
          tx,
        );

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.SUPPLIER,
          entityId: created.id,
          action: AuditAction.CREATE,
          after: created,
        });

        return created;
      }),
    );
  },

  async update(actor: Actor, id: string, input: UpdateSupplierInput): Promise<SupplierRecord> {
    assertAdmin(actor);

    const existing = await supplierRepository.findById(id);
    if (!existing) throw notFound();

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const updated = await supplierRepository.update(
          id,
          {
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.taxId === undefined ? {} : { taxId: input.taxId ?? null }),
            ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
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
            entityType: AuditEntityType.SUPPLIER,
            entityId: id,
            action:
              input.isActive === true
                ? AuditAction.ACTIVATE
                : input.isActive === false
                  ? AuditAction.DEACTIVATE
                  : AuditAction.UPDATE,
            before: changes.before,
            after: changes.after,
          });
        }

        return updated;
      }),
    );
  },
} as const;
