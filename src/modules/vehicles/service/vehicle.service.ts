/**
 * Vehicle administration (SRS 13, 21.5).
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
import { Role } from '@/modules/services/domain/service-status';
import { vehicleRepository, type VehicleRecord } from '../repository/vehicle.repository';
import type { CreateVehicleInput, UpdateVehicleInput } from '../schemas/vehicle.schema';

function assertAdmin(actor: Actor): void {
  if (actor.role !== Role.ADMIN) throw forbidden();
}

export const vehicleService = {
  /**
   * SRS 13.2 for administrators; SRS 12.5 for drivers.
   *
   * Deliberately not admin-only: a driver needs the active list to choose a
   * vehicle. But the filter is overridden rather than trusted, so a driver
   * requesting inactive vehicles still receives only active ones — SRS 13.4
   * forbids offering a deactivated vehicle for a new service.
   */
  async list(
    actor: Actor,
    filters: { isActive?: boolean | undefined } = {},
  ): Promise<VehicleRecord[]> {
    const scoped = actor.role === Role.ADMIN ? filters : { isActive: true };
    return vehicleRepository.list(scoped);
  },

  async getById(actor: Actor, id: string): Promise<VehicleRecord> {
    assertAdmin(actor);
    const vehicle = await vehicleRepository.findById(id);
    if (!vehicle) throw notFound();
    return vehicle;
  },

  async create(actor: Actor, input: CreateVehicleInput): Promise<VehicleRecord> {
    assertAdmin(actor);

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const created = await vehicleRepository.create(
          {
            registrationPlate: input.registrationPlate,
            referenceName: input.referenceName ?? null,
            isActive: input.isActive,
          },
          tx,
        );

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.VEHICLE,
          entityId: created.id,
          action: AuditAction.CREATE,
          after: created,
        });

        return created;
      }),
    );
  },

  /**
   * Edits a vehicle, deactivation included (SRS 13.3, 13.4).
   *
   * There is no delete. The `onDelete: Restrict` foreign keys mean a vehicle
   * attached to a service could not be removed even by a future endpoint that
   * tried, which is SRS 21.5 enforced structurally rather than by convention.
   */
  async update(actor: Actor, id: string, input: UpdateVehicleInput): Promise<VehicleRecord> {
    assertAdmin(actor);

    const existing = await vehicleRepository.findById(id);
    if (!existing) throw notFound();

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const updated = await vehicleRepository.update(
          id,
          {
            ...(input.registrationPlate === undefined
              ? {}
              : { registrationPlate: input.registrationPlate }),
            ...(input.referenceName === undefined
              ? {}
              : { referenceName: input.referenceName ?? null }),
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
            entityType: AuditEntityType.VEHICLE,
            entityId: id,
            // A deactivation is the operationally interesting event — it removes
            // the vehicle from every driver's picker — so it gets its own action
            // rather than hiding inside a generic UPDATE.
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
