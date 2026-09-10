/**
 * Daily-km-log administration (ERP roadmap Phase 5). Admin-only end to end.
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
import { businessRuleViolation, forbidden, notFound } from '@/lib/errors/app-error';
import { ERRORS } from '@/lib/i18n/messages';
import { routeRepository } from '@/modules/routes/repository/route.repository';
import { Role } from '@/modules/services/domain/service-status';
import type { Pagination } from '@/modules/shared/schemas/common';
import { userRepository } from '@/modules/users/repository/user.repository';
import { vehicleRepository } from '@/modules/vehicles/repository/vehicle.repository';
import {
  dailyKmLogRepository,
  type DailyKmLogWithRelations,
} from '../repository/daily-km-log.repository';
import type { CreateDailyKmLogInput, UpdateDailyKmLogInput } from '../schemas/daily-km-log.schema';

function assertAdmin(actor: Actor): void {
  if (actor.role !== Role.ADMIN) throw forbidden();
}

async function assertActiveVehicle(vehicleId: string): Promise<void> {
  const vehicle = await vehicleRepository.findById(vehicleId);
  if (!vehicle) throw notFound();
  if (!vehicle.isActive) throw businessRuleViolation(ERRORS.vehicleInactive);
}

async function assertRoute(routeId: string | undefined): Promise<void> {
  if (routeId === undefined) return;
  const route = await routeRepository.findById(routeId);
  if (!route) throw notFound();
}

async function assertDriver(driverId: string | undefined): Promise<void> {
  if (driverId === undefined) return;
  const driver = await userRepository.findById(driverId);
  if (!driver) throw notFound();
  if (driver.role !== Role.DRIVER) throw businessRuleViolation(ERRORS.userNotDriver);
}

export const dailyKmLogService = {
  async listPage(
    actor: Actor,
    filters: { vehicleId?: string },
    pagination: Pagination,
  ): Promise<{ items: DailyKmLogWithRelations[]; total: number }> {
    assertAdmin(actor);
    return dailyKmLogRepository.listPage(filters, pagination);
  },

  async getById(actor: Actor, id: string): Promise<DailyKmLogWithRelations> {
    assertAdmin(actor);
    const found = await dailyKmLogRepository.findById(id);
    if (!found) throw notFound();
    return found;
  },

  async create(actor: Actor, input: CreateDailyKmLogInput): Promise<DailyKmLogWithRelations> {
    assertAdmin(actor);

    await assertActiveVehicle(input.vehicleId);
    await assertRoute(input.routeId);
    await assertDriver(input.driverId);

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const created = await dailyKmLogRepository.create(
          {
            vehicleId: input.vehicleId,
            routeId: input.routeId ?? null,
            driverId: input.driverId ?? null,
            date: new Date(`${input.date}T00:00:00.000Z`),
            actualKm: input.actualKm,
            workedMinutes: input.workedHours ?? null,
            notes: input.notes ?? null,
          },
          tx,
        );

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.DAILY_KM_LOG,
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
    input: UpdateDailyKmLogInput,
  ): Promise<DailyKmLogWithRelations> {
    assertAdmin(actor);

    const existing = await dailyKmLogRepository.findById(id);
    if (!existing) throw notFound();

    if (input.vehicleId !== undefined) await assertActiveVehicle(input.vehicleId);
    await assertRoute(input.routeId);
    await assertDriver(input.driverId);

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const updated = await dailyKmLogRepository.update(
          id,
          {
            ...(input.vehicleId === undefined ? {} : { vehicleId: input.vehicleId }),
            ...(input.routeId === undefined ? {} : { routeId: input.routeId ?? null }),
            ...(input.driverId === undefined ? {} : { driverId: input.driverId ?? null }),
            ...(input.date === undefined
              ? {}
              : { date: new Date(`${input.date}T00:00:00.000Z`) }),
            ...(input.actualKm === undefined ? {} : { actualKm: input.actualKm }),
            ...(input.workedHours === undefined ? {} : { workedMinutes: input.workedHours ?? null }),
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
            entityType: AuditEntityType.DAILY_KM_LOG,
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

    const existing = await dailyKmLogRepository.findById(id);
    if (!existing) throw notFound();

    await withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.DAILY_KM_LOG,
          entityId: id,
          action: AuditAction.DELETE,
          before: existing,
        });

        await dailyKmLogRepository.delete(id, tx);
      }),
    );
  },
} as const;
