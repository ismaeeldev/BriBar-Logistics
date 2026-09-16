/**
 * End client ("Cliente final") administration. Admin-only end to end, same
 * shape as `client.service.ts` (client change request 2026-09-17).
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
import { endClientRepository, type EndClientRecord } from '../repository/end-client.repository';
import type { CreateEndClientInput, UpdateEndClientInput } from '../schemas/end-client.schema';

function assertAdmin(actor: Actor): void {
  if (actor.role !== Role.ADMIN) throw forbidden();
}

export const endClientService = {
  async list(
    actor: Actor,
    filters: { isActive?: boolean | undefined } = {},
  ): Promise<EndClientRecord[]> {
    assertAdmin(actor);
    return endClientRepository.list(filters);
  },

  async listPage(
    actor: Actor,
    filters: { isActive?: boolean | undefined; q?: string },
    pagination: Pagination,
  ): Promise<{ items: EndClientRecord[]; total: number }> {
    assertAdmin(actor);
    return endClientRepository.listPage(filters, pagination);
  },

  async getById(actor: Actor, id: string): Promise<EndClientRecord> {
    assertAdmin(actor);
    const found = await endClientRepository.findById(id);
    if (!found) throw notFound();
    return found;
  },

  async getDeletability(actor: Actor, id: string): Promise<Deletability> {
    assertAdmin(actor);
    const counts = await endClientRepository.countDependents(id);
    return toDeletability(counts);
  },

  async remove(actor: Actor, id: string): Promise<void> {
    assertAdmin(actor);

    const existing = await endClientRepository.findById(id);
    if (!existing) throw notFound();

    await withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const counts = await endClientRepository.countDependents(id, tx);
        if (!toDeletability(counts).canDelete) {
          throw businessRuleViolation(ERRORS.deleteBlocked);
        }

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.END_CLIENT,
          entityId: id,
          action: AuditAction.DELETE,
          before: existing,
        });

        await endClientRepository.delete(id, tx);
      }),
    );
  },

  async create(actor: Actor, input: CreateEndClientInput): Promise<EndClientRecord> {
    assertAdmin(actor);

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const created = await endClientRepository.create(
          {
            name: input.name,
            taxId: input.taxId ?? null,
            isActive: input.isActive,
          },
          tx,
        );

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.END_CLIENT,
          entityId: created.id,
          action: AuditAction.CREATE,
          after: created,
        });

        return created;
      }),
    );
  },

  async update(actor: Actor, id: string, input: UpdateEndClientInput): Promise<EndClientRecord> {
    assertAdmin(actor);

    const existing = await endClientRepository.findById(id);
    if (!existing) throw notFound();

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const updated = await endClientRepository.update(
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
            entityType: AuditEntityType.END_CLIENT,
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
