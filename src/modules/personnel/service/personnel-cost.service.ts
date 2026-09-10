/**
 * Personnel-cost administration (ERP roadmap Phase 5). Admin-only end to end.
 */
import {
  AuditAction,
  AuditEntityType,
  diffForAudit,
  writeAudit,
} from '@/lib/audit/audit-service';
import type { Actor } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { withTranslatedErrors } from '@/lib/db/with-translated-errors';
import { forbidden, notFound } from '@/lib/errors/app-error';
import { computeDailyFixedCostCents } from '@/modules/personnel/domain/personnel-cost';
import { Role } from '@/modules/services/domain/service-status';
import type { Pagination } from '@/modules/shared/schemas/common';
import { userRepository } from '@/modules/users/repository/user.repository';
import {
  personnelCostRepository,
  type PersonnelCostWithRelations,
} from '../repository/personnel-cost.repository';
import type {
  CreatePersonnelCostInput,
  UpdatePersonnelCostInput,
} from '../schemas/personnel-cost.schema';

/** A cost row plus the figure computed from it — see `domain/personnel-cost.ts`. */
export interface PersonnelCostDetail extends PersonnelCostWithRelations {
  dailyFixedCostCents: number;
}

function assertAdmin(actor: Actor): void {
  if (actor.role !== Role.ADMIN) throw forbidden();
}

function withDailyFixedCost(record: PersonnelCostWithRelations): PersonnelCostDetail {
  return {
    ...record,
    dailyFixedCostCents: computeDailyFixedCostCents(record.totalCents, record.year, record.month),
  };
}

function totalOf(input: {
  base: number;
  overtime?: number | null | undefined;
  allowances?: number | null | undefined;
  other?: number | null | undefined;
}): number {
  return input.base + (input.overtime ?? 0) + (input.allowances ?? 0) + (input.other ?? 0);
}

export const personnelCostService = {
  async listPage(
    actor: Actor,
    filters: { userId?: string; year?: number },
    pagination: Pagination,
  ): Promise<{ items: PersonnelCostDetail[]; total: number }> {
    assertAdmin(actor);
    const { items, total } = await personnelCostRepository.listPage(filters, pagination);
    return { items: items.map(withDailyFixedCost), total };
  },

  async getById(actor: Actor, id: string): Promise<PersonnelCostDetail> {
    assertAdmin(actor);
    const found = await personnelCostRepository.findById(id);
    if (!found) throw notFound();
    return withDailyFixedCost(found);
  },

  async create(actor: Actor, input: CreatePersonnelCostInput): Promise<PersonnelCostDetail> {
    assertAdmin(actor);

    const user = await userRepository.findById(input.userId);
    if (!user) throw notFound();

    const totalCents = totalOf(input);

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const created = await personnelCostRepository.create(
          {
            userId: input.userId,
            year: input.year,
            month: input.month,
            baseCents: input.base,
            overtimeCents: input.overtime ?? null,
            allowancesCents: input.allowances ?? null,
            otherCents: input.other ?? null,
            totalCents,
            notes: input.notes ?? null,
          },
          tx,
        );

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.PERSONNEL_COST,
          entityId: created.id,
          action: AuditAction.CREATE,
          after: created,
        });

        return created;
      }),
    ).then(withDailyFixedCost);
  },

  async update(
    actor: Actor,
    id: string,
    input: UpdatePersonnelCostInput,
  ): Promise<PersonnelCostDetail> {
    assertAdmin(actor);

    const existing = await personnelCostRepository.findById(id);
    if (!existing) throw notFound();

    if (input.userId !== undefined) {
      const user = await userRepository.findById(input.userId);
      if (!user) throw notFound();
    }

    // The total is recalculated whenever any of its four components changes
    // - never trusted from the request, and never left stale when only one
    // component was actually edited.
    const recalculate =
      input.base !== undefined ||
      input.overtime !== undefined ||
      input.allowances !== undefined ||
      input.other !== undefined;
    const totalCents = recalculate
      ? totalOf({
          base: input.base ?? existing.baseCents,
          overtime: input.overtime === undefined ? existing.overtimeCents : input.overtime,
          allowances:
            input.allowances === undefined ? existing.allowancesCents : input.allowances,
          other: input.other === undefined ? existing.otherCents : input.other,
        })
      : existing.totalCents;

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const updated = await personnelCostRepository.update(
          id,
          {
            ...(input.userId === undefined ? {} : { userId: input.userId }),
            ...(input.year === undefined ? {} : { year: input.year }),
            ...(input.month === undefined ? {} : { month: input.month }),
            ...(input.base === undefined ? {} : { baseCents: input.base }),
            ...(input.overtime === undefined ? {} : { overtimeCents: input.overtime }),
            ...(input.allowances === undefined ? {} : { allowancesCents: input.allowances }),
            ...(input.other === undefined ? {} : { otherCents: input.other }),
            totalCents,
            ...(input.notes === undefined ? {} : { notes: input.notes ?? null }),
          },
          tx,
        );

        const changes = diffForAudit(
          existing as unknown as Record<string, unknown>,
          { ...input, totalCents } as Record<string, unknown>,
        );

        if (changes) {
          await writeAudit(tx, {
            actorUserId: actor.userId,
            entityType: AuditEntityType.PERSONNEL_COST,
            entityId: id,
            action: AuditAction.UPDATE,
            before: changes.before,
            after: changes.after,
          });
        }

        return updated;
      }),
    ).then(withDailyFixedCost);
  },

  async remove(actor: Actor, id: string): Promise<void> {
    assertAdmin(actor);

    const existing = await personnelCostRepository.findById(id);
    if (!existing) throw notFound();

    await withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.PERSONNEL_COST,
          entityId: id,
          action: AuditAction.DELETE,
          before: existing,
        });

        await personnelCostRepository.delete(id, tx);
      }),
    );
  },
} as const;
