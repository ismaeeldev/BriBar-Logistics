/**
 * Simple-lookup-list administration (ERP roadmap Phase 1). Admin-only, and
 * every method takes `kind` as its own parameter rather than trusting the
 * caller to have already scoped a query — see `lookup.repository.ts`.
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
  lookupRepository,
  type LookupItemRecord,
  type LookupKind,
} from '../repository/lookup.repository';
import type { CreateLookupItemInput, UpdateLookupItemInput } from '../schemas/lookup.schema';

function assertAdmin(actor: Actor): void {
  if (actor.role !== Role.ADMIN) throw forbidden();
}

export const lookupService = {
  async list(
    actor: Actor,
    kind: LookupKind,
    filters: { isActive?: boolean | undefined } = {},
  ): Promise<LookupItemRecord[]> {
    assertAdmin(actor);
    return lookupRepository.list(kind, filters);
  },

  async listPage(
    actor: Actor,
    kind: LookupKind,
    filters: { isActive?: boolean | undefined; q?: string },
    pagination: Pagination,
  ): Promise<{ items: LookupItemRecord[]; total: number }> {
    assertAdmin(actor);
    return lookupRepository.listPage(kind, filters, pagination);
  },

  async getById(actor: Actor, kind: LookupKind, id: string): Promise<LookupItemRecord> {
    assertAdmin(actor);
    const found = await lookupRepository.findById(kind, id);
    if (!found) throw notFound();
    return found;
  },

  async getDeletability(actor: Actor, kind: LookupKind, id: string): Promise<Deletability> {
    assertAdmin(actor);
    const counts = await lookupRepository.countDependents(kind, id);
    return toDeletability(counts);
  },

  async remove(actor: Actor, kind: LookupKind, id: string): Promise<void> {
    assertAdmin(actor);

    const existing = await lookupRepository.findById(kind, id);
    if (!existing) throw notFound();

    await withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const counts = await lookupRepository.countDependents(kind, id, tx);
        if (!toDeletability(counts).canDelete) {
          throw businessRuleViolation(ERRORS.deleteBlocked);
        }

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.LOOKUP_ITEM,
          entityId: id,
          action: AuditAction.DELETE,
          before: existing,
        });

        await lookupRepository.delete(kind, id, tx);
      }),
    );
  },

  async create(
    actor: Actor,
    kind: LookupKind,
    input: CreateLookupItemInput,
  ): Promise<LookupItemRecord> {
    assertAdmin(actor);

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const created = await lookupRepository.create(
          kind,
          { name: input.name, isActive: input.isActive },
          tx,
        );

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.LOOKUP_ITEM,
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
    kind: LookupKind,
    id: string,
    input: UpdateLookupItemInput,
  ): Promise<LookupItemRecord> {
    assertAdmin(actor);

    const existing = await lookupRepository.findById(kind, id);
    if (!existing) throw notFound();

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const updated = await lookupRepository.update(
          kind,
          id,
          {
            ...(input.name === undefined ? {} : { name: input.name }),
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
            entityType: AuditEntityType.LOOKUP_ITEM,
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
