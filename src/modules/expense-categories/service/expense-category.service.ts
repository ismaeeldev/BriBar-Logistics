/**
 * Expense category administration (ERP roadmap Phase 3). Admin-only end to end.
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
import {
  expenseCategoryRepository,
  type ExpenseCategoryRecord,
} from '../repository/expense-category.repository';
import type {
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
} from '../schemas/expense-category.schema';

function assertAdmin(actor: Actor): void {
  if (actor.role !== Role.ADMIN) throw forbidden();
}

export const expenseCategoryService = {
  /**
   * Read-only for anyone signed in, not admin-only — a future driver-facing
   * expense capture (not in this phase) would need to read the list too, the
   * same reasoning `configService.get` already applies (ADR 0012). Nothing
   * here is sensitive the way a rate is.
   */
  async list(filters: { isActive?: boolean | undefined } = {}): Promise<ExpenseCategoryRecord[]> {
    return expenseCategoryRepository.list(filters);
  },

  async listPage(
    actor: Actor,
    filters: { isActive?: boolean | undefined; q?: string },
    pagination: Pagination,
  ): Promise<{ items: ExpenseCategoryRecord[]; total: number }> {
    assertAdmin(actor);
    return expenseCategoryRepository.listPage(filters, pagination);
  },

  async getById(actor: Actor, id: string): Promise<ExpenseCategoryRecord> {
    assertAdmin(actor);
    const found = await expenseCategoryRepository.findById(id);
    if (!found) throw notFound();
    return found;
  },

  async getDeletability(actor: Actor, id: string): Promise<Deletability> {
    assertAdmin(actor);
    const counts = await expenseCategoryRepository.countDependents(id);
    return toDeletability(counts);
  },

  async remove(actor: Actor, id: string): Promise<void> {
    assertAdmin(actor);

    const existing = await expenseCategoryRepository.findById(id);
    if (!existing) throw notFound();

    await withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const counts = await expenseCategoryRepository.countDependents(id, tx);
        if (!toDeletability(counts).canDelete) {
          throw businessRuleViolation(ERRORS.deleteBlocked);
        }

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.EXPENSE_CATEGORY,
          entityId: id,
          action: AuditAction.DELETE,
          before: existing,
        });

        await expenseCategoryRepository.delete(id, tx);
      }),
    );
  },

  async create(
    actor: Actor,
    input: CreateExpenseCategoryInput,
  ): Promise<ExpenseCategoryRecord> {
    assertAdmin(actor);

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const created = await expenseCategoryRepository.create(
          {
            name: input.name,
            expenseType: input.expenseType,
            defaultVatRate: input.defaultVatRate,
            isActive: input.isActive,
          },
          tx,
        );

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.EXPENSE_CATEGORY,
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
    input: UpdateExpenseCategoryInput,
  ): Promise<ExpenseCategoryRecord> {
    assertAdmin(actor);

    const existing = await expenseCategoryRepository.findById(id);
    if (!existing) throw notFound();

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const updated = await expenseCategoryRepository.update(
          id,
          {
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.expenseType === undefined ? {} : { expenseType: input.expenseType }),
            ...(input.defaultVatRate === undefined
              ? {}
              : { defaultVatRate: input.defaultVatRate }),
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
            entityType: AuditEntityType.EXPENSE_CATEGORY,
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
