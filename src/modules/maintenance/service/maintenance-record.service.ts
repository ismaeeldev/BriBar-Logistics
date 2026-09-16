/**
 * Maintenance-record administration (ERP roadmap Phase 5). Admin-only end to
 * end, mirroring `received-invoice.service.ts`'s structure.
 */
import { AuditAction, AuditEntityType, diffForAudit, writeAudit } from '@/lib/audit/audit-service';
import type { Actor } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { withTranslatedErrors } from '@/lib/db/with-translated-errors';
import { businessRuleViolation, forbidden, notFound } from '@/lib/errors/app-error';
import { ERRORS } from '@/lib/i18n/messages';
import {
  maintenanceUrgency,
  type MaintenanceUrgency,
} from '@/modules/maintenance/domain/maintenance-urgency';
import { dailyKmLogRepository } from '@/modules/daily-km/repository/daily-km-log.repository';
import { lookupRepository } from '@/modules/lookup/repository/lookup.repository';
import { refuellingRepository } from '@/modules/refuelling/repository/refuelling.repository';
import { Role } from '@/modules/services/domain/service-status';
import { formatDocumentCode } from '@/modules/shared/domain/document-sequence';
import type { Pagination } from '@/modules/shared/schemas/common';
import { vehicleRepository } from '@/modules/vehicles/repository/vehicle.repository';
import {
  maintenanceRecordRepository,
  type MaintenanceRecordWithRelations,
} from '../repository/maintenance-record.repository';
import type {
  CreateMaintenanceRecordInput,
  UpdateMaintenanceRecordInput,
} from '../schemas/maintenance-record.schema';

function assertAdmin(actor: Actor): void {
  if (actor.role !== Role.ADMIN) throw forbidden();
}

async function assertActiveVehicle(vehicleId: string): Promise<void> {
  const vehicle = await vehicleRepository.findById(vehicleId);
  if (!vehicle) throw notFound();
  if (!vehicle.isActive) throw businessRuleViolation(ERRORS.vehicleInactive);
}

async function assertMaintenanceType(maintenanceTypeId: string): Promise<void> {
  const item = await lookupRepository.findById('MAINTENANCE_TYPE', maintenanceTypeId);
  if (!item) throw businessRuleViolation(ERRORS.lookupKindMismatch);
}

/** A record plus the band computed from it — see `domain/maintenance-urgency.ts`. */
export interface MaintenanceRecordDetail extends MaintenanceRecordWithRelations {
  urgency: MaintenanceUrgency;
}

/**
 * The best available odometer estimate for a vehicle "today": the more
 * recent of its last refuelling reading and its last daily-km-log reading —
 * neither log is complete on its own, and a vehicle need not have both.
 * Mirrors `refuellingRepository.previousForVehicle`'s own reasoning for
 * picking the chronologically-latest row rather than the most-recently
 * *entered* one.
 */
async function currentOdometerKm(vehicleId: string): Promise<number | null> {
  const [refuel, kmLog] = await Promise.all([
    // We want the absolute latest refuelling, so we pass a far-future date
    // to bypass the `lte` filter in `previousForVehicle`.
    refuellingRepository.previousForVehicle(vehicleId, new Date('9999-12-31T23:59:59Z')),
    dailyKmLogRepository.mostRecentForVehicle(vehicleId),
  ]);

  if (!refuel && !kmLog) return null;
  if (!refuel) return kmLog!.actualKm;
  if (!kmLog) return refuel.odometerKm;

  // `refuel` carries no date in its projection (only `odometerKm`), so when
  // both exist the daily log — which does carry a date and is the more
  // deliberately-recorded of the two for exactly this purpose — wins ties.
  return kmLog.actualKm >= refuel.odometerKm ? kmLog.actualKm : refuel.odometerKm;
}

function withUrgency(
  record: MaintenanceRecordWithRelations,
  currentKm: number | null,
): MaintenanceRecordDetail {
  return {
    ...record,
    urgency: maintenanceUrgency({
      nextDueKm: record.nextDueKm,
      currentKm,
      nextDueDate: record.nextDueDate,
      today: new Date(),
    }),
  };
}

export const maintenanceRecordService = {
  async listPage(
    actor: Actor,
    filters: { vehicleId?: string; maintenanceTypeId?: string },
    pagination: Pagination,
  ): Promise<{ items: MaintenanceRecordWithRelations[]; total: number }> {
    assertAdmin(actor);
    return maintenanceRecordRepository.listPage(filters, pagination);
  },

  async getById(actor: Actor, id: string): Promise<MaintenanceRecordDetail> {
    assertAdmin(actor);
    const found = await maintenanceRecordRepository.findById(id);
    if (!found) throw notFound();
    const currentKm = await currentOdometerKm(found.vehicleId);
    return withUrgency(found, currentKm);
  },

  /**
   * The fleet-wide "due soon" alert view (roadmap §4, `08_Mantenimiento`'s
   * URGENTE/PRÓXIMO/OK bands). One row per open record — see
   * `maintenanceRecordRepository.withOpenSchedule` for why closed records
   * (neither signal set) are excluded before this point rather than after —
   * sorted so the most urgent leads.
   */
  async dueSummary(actor: Actor): Promise<MaintenanceRecordDetail[]> {
    assertAdmin(actor);

    const records = await maintenanceRecordRepository.withOpenSchedule();
    if (records.length === 0) return [];

    const vehicleIds = [...new Set(records.map((record) => record.vehicleId))];
    const odometers = new Map(
      await Promise.all(
        vehicleIds.map(
          async (vehicleId) => [vehicleId, await currentOdometerKm(vehicleId)] as const,
        ),
      ),
    );

    const SEVERITY: Record<MaintenanceUrgency, number> = {
      URGENT: 3,
      UPCOMING: 2,
      OK: 1,
      UNKNOWN: 0,
    };

    return records
      .map((record) => withUrgency(record, odometers.get(record.vehicleId) ?? null))
      .sort((a, b) => SEVERITY[b.urgency] - SEVERITY[a.urgency]);
  },

  async create(
    actor: Actor,
    input: CreateMaintenanceRecordInput,
  ): Promise<MaintenanceRecordWithRelations> {
    assertAdmin(actor);

    await assertActiveVehicle(input.vehicleId);
    await assertMaintenanceType(input.maintenanceTypeId);

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const sequence = await maintenanceRecordRepository.nextMaintenanceSequence(tx);

        const created = await maintenanceRecordRepository.create(
          {
            maintenanceCode: formatDocumentCode('MT', 6, sequence),
            vehicleId: input.vehicleId,
            maintenanceTypeId: input.maintenanceTypeId,
            performedDate: new Date(`${input.performedDate}T00:00:00.000Z`),
            performedKm: input.performedKm ?? null,
            nextDueKm: input.nextDueKm ?? null,
            nextDueDate: input.nextDueDate
              ? new Date(`${input.nextDueDate}T00:00:00.000Z`)
              : null,
            notes: input.notes ?? null,
          },
          tx,
        );

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.MAINTENANCE_RECORD,
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
    input: UpdateMaintenanceRecordInput,
  ): Promise<MaintenanceRecordWithRelations> {
    assertAdmin(actor);

    const existing = await maintenanceRecordRepository.findById(id);
    if (!existing) throw notFound();

    if (input.vehicleId !== undefined) await assertActiveVehicle(input.vehicleId);
    if (input.maintenanceTypeId !== undefined) await assertMaintenanceType(input.maintenanceTypeId);

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const updated = await maintenanceRecordRepository.update(
          id,
          {
            ...(input.vehicleId === undefined ? {} : { vehicleId: input.vehicleId }),
            ...(input.maintenanceTypeId === undefined
              ? {}
              : { maintenanceTypeId: input.maintenanceTypeId }),
            ...(input.performedDate === undefined
              ? {}
              : { performedDate: new Date(`${input.performedDate}T00:00:00.000Z`) }),
            ...(input.performedKm === undefined ? {} : { performedKm: input.performedKm ?? null }),
            ...(input.nextDueKm === undefined ? {} : { nextDueKm: input.nextDueKm ?? null }),
            ...(input.nextDueDate === undefined
              ? {}
              : {
                  nextDueDate: input.nextDueDate
                    ? new Date(`${input.nextDueDate}T00:00:00.000Z`)
                    : null,
                }),
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
            entityType: AuditEntityType.MAINTENANCE_RECORD,
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

    const existing = await maintenanceRecordRepository.findById(id);
    if (!existing) throw notFound();

    await withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.MAINTENANCE_RECORD,
          entityId: id,
          action: AuditAction.DELETE,
          before: existing,
        });

        await maintenanceRecordRepository.delete(id, tx);
      }),
    );
  },
} as const;
