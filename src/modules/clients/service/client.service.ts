/**
 * Client administration (ERP roadmap Phase 1). Admin-only end to end — unlike
 * vehicles and routes, nothing here is ever read by a driver-facing screen.
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
import { clientRepository, type ClientRecord } from '../repository/client.repository';
import type { CreateClientInput, UpdateClientInput } from '../schemas/client.schema';

function assertAdmin(actor: Actor): void {
  if (actor.role !== Role.ADMIN) throw forbidden();
}

export const clientService = {
  async list(
    actor: Actor,
    filters: { isActive?: boolean | undefined } = {},
  ): Promise<ClientRecord[]> {
    assertAdmin(actor);
    return clientRepository.list(filters);
  },

  async listPage(
    actor: Actor,
    filters: { isActive?: boolean | undefined; q?: string },
    pagination: Pagination,
  ): Promise<{ items: ClientRecord[]; total: number }> {
    assertAdmin(actor);
    return clientRepository.listPage(filters, pagination);
  },

  async getById(actor: Actor, id: string): Promise<ClientRecord> {
    assertAdmin(actor);
    const found = await clientRepository.findById(id);
    if (!found) throw notFound();
    return found;
  },

  async getDeletability(actor: Actor, id: string): Promise<Deletability> {
    assertAdmin(actor);
    const counts = await clientRepository.countDependents(id);
    return toDeletability(counts);
  },

  async remove(actor: Actor, id: string): Promise<void> {
    assertAdmin(actor);

    const existing = await clientRepository.findById(id);
    if (!existing) throw notFound();

    await withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const counts = await clientRepository.countDependents(id, tx);
        if (!toDeletability(counts).canDelete) {
          throw businessRuleViolation(ERRORS.deleteBlocked);
        }

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.CLIENT,
          entityId: id,
          action: AuditAction.DELETE,
          before: existing,
        });

        await clientRepository.delete(id, tx);
      }),
    );
  },

  async create(actor: Actor, input: CreateClientInput): Promise<ClientRecord> {
    assertAdmin(actor);

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const created = await clientRepository.create(
          {
            name: input.name,
            taxId: input.taxId ?? null,
            isActive: input.isActive,
          },
          tx,
        );

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.CLIENT,
          entityId: created.id,
          action: AuditAction.CREATE,
          after: created,
        });

        return created;
      }),
    );
  },

  async update(actor: Actor, id: string, input: UpdateClientInput): Promise<ClientRecord> {
    assertAdmin(actor);

    const existing = await clientRepository.findById(id);
    if (!existing) throw notFound();

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const updated = await clientRepository.update(
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
            entityType: AuditEntityType.CLIENT,
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
