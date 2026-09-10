/**
 * The service workflow (SRS 9, 10, 11, 14.5, 21).
 *
 * This is the authoritative layer. Route handlers parse and respond; the domain
 * layer states rules; repositories move rows. Everything that decides *whether*
 * something may happen, and everything that must happen atomically with it,
 * lives here.
 *
 * Three properties hold for every write below:
 *
 *   1. **Authorisation is checked against the database, not the request.** The
 *      actor comes from `requireUser`, which re-reads the user; the subject is
 *      re-read before every decision (SRS 8.3, 22.3).
 *   2. **Server-owned values are computed here, never accepted.** Service ID,
 *      business date, origin/destination snapshots, and both mileage
 *      calculations are produced by this file. The request schemas do not even
 *      have fields for them (SRS 9.6, 10.2, 22.4).
 *   3. **State, history and audit commit together.** SRS 11.3 asks for a
 *      transaction around approval; the same reasoning applies to creation and
 *      edits, so all three use one.
 */
import { ServiceStatus as PrismaServiceStatus, type Prisma } from '@prisma/client';

import type { Actor } from '@/lib/auth/session';
import {
  AuditAction,
  AuditEntityType,
  diffForAudit,
  writeAudit,
} from '@/lib/audit/audit-service';
import { prisma, type PrismaTransactionClient } from '@/lib/db/prisma';
import { withTranslatedErrors } from '@/lib/db/with-translated-errors';
import { env } from '@/lib/env';
import {
  businessRuleViolation,
  conflict,
  configurationRequired,
  forbidden,
  notFound,
} from '@/lib/errors/app-error';
import { ERRORS } from '@/lib/i18n/messages';
import { currentBusinessDate } from '@/lib/time/business-date';
import { timeOfDayToDate, type TimeOfDay } from '@/lib/time/time-of-day';
import { notificationService } from '@/modules/notifications/service/notification.service';
import { userRepository } from '@/modules/users/repository/user.repository';
import { vehicleRepository } from '@/modules/vehicles/repository/vehicle.repository';
import { toPrismaPagination, type Pagination } from '@/modules/shared/schemas/common';
import { computeBaseCents } from '../domain/billing';
import { calculateMileage, validateMileage } from '../domain/mileage';
import { formatServiceCode } from '../domain/service-code';
import { validateServiceTimes } from '../domain/service-times';
import {
  Role,
  ServiceStatus,
  canApprove,
  canEdit,
  canCreateFor,
} from '../domain/service-status';
import { serviceRepository, type ServiceWithRelations } from '../repository/service.repository';
import type {
  AdminCreateServiceInput,
  CreateServiceInput,
  ServiceFilterInput,
  UpdateServiceInput,
} from '../schemas/service.schema';

/** The fields a create or edit supplies, before the server adds its own. */
type ServiceBody = CreateServiceInput;

/**
 * The context the Add Service screen needs (SRS 18.3, 9.2).
 *
 * Assembled server-side so the browser never decides what a driver is allowed
 * to pick from.
 */
export interface ServiceContext {
  driver: { id: string; name: string };
  serviceDate: Date;
  defaultVehicleId: string | null;
  vehicles: { id: string; registrationPlate: string; referenceName: string | null }[];
  routes: {
    id: string;
    code: string;
    name: string;
    origin: string;
    destination: string;
    isDefault: boolean;
  }[];
  defaultRouteId: string | null;
}

/**
 * Re-reads and re-authorises the target of a mutation.
 *
 * Called inside the transaction rather than before it, so the decision is made
 * against the row the write will actually touch.
 */
async function loadForEdit(
  tx: PrismaTransactionClient,
  id: string,
  actor: Actor,
): Promise<ServiceWithRelations> {
  const service = await serviceRepository.findByIdForActor(id, actor, tx);

  // Absent, or not this driver's. SRS 18.7 and 24.3 both make 404 the right
  // answer for the second case, and the repository's ownership scoping means
  // the two are already indistinguishable here.
  if (!service) throw notFound();

  if (!canEdit(actor, { driverId: service.driverId, status: service.status })) {
    // Reached only when the actor *can* see the service but not change it,
    // which for a driver means it has been approved (SRS 11.4, 11.5).
    throw conflict(ERRORS.serviceLocked);
  }

  return service;
}

/**
 * Validates the parts of a body that need the database, and resolves the route
 * snapshot.
 *
 * The pure rules (mileage ordering, time ordering) already ran in the Zod
 * schema. They run again here — cheaply, on plain numbers — because the service
 * layer must be safe to call from anywhere, not only from behind a parsed
 * request (SRS 10.2: "the backend shall always recalculate before persisting").
 */
async function resolveBody(
  tx: PrismaTransactionClient,
  driverId: string,
  body: ServiceBody,
): Promise<{
  origin: string;
  destination: string;
  actualKm: number;
  serviceKm: number;
  /** The route's current default rate, in EUR cents (ERP roadmap Phase 0). */
  routeDefaultRateCents: number | null;
}> {
  const mileageViolations = validateMileage(body);
  const timeViolations = validateServiceTimes(body);

  if (mileageViolations.length > 0 || timeViolations.length > 0) {
    throw businessRuleViolation(ERRORS.validationFailed);
  }

  // SRS 14.3, 26.2: the route must be assigned to *this* driver and active.
  // Checked against the database on every write, so submitting an unassigned
  // route id by hand fails regardless of what the picker offered.
  const routeAssignable = await userRepository.isRouteAssignable(driverId, body.routeId, tx);
  if (!routeAssignable) throw businessRuleViolation(ERRORS.routeNotAssigned);

  // SRS 13.5: only an active vehicle may be chosen for a new service.
  const vehicleSelectable = await vehicleRepository.isSelectable(body.vehicleId, tx);
  if (!vehicleSelectable) throw businessRuleViolation(ERRORS.vehicleInactive);

  const route = await tx.route.findUniqueOrThrow({
    where: { id: body.routeId },
    select: { origin: true, destination: true, defaultRateCents: true },
  });

  // Client change request (2026-09-09): the driver may override the route's
  // origin/destination on this service. A blank field falls back to the route's
  // current value; whichever wins is snapshotted (SRS 14.5), so editing the
  // route master later still cannot rewrite this row.
  const origin = body.origin?.trim() || route.origin;
  const destination = body.destination?.trim() || route.destination;

  return {
    origin,
    destination,
    routeDefaultRateCents: route.defaultRateCents,
    ...calculateMileage(body),
  };
}

/**
 * Maps a validated body onto the columns a write touches.
 *
 * `rateCents` is a third, separate argument rather than part of `resolved`
 * because create and update disagree about where it comes from: a new
 * service always snapshots the route's *current* default (client change
 * request 2026-09-09); an edit must never silently overwrite whatever an
 * administrator has since set on this particular service, so `update()`
 * omits the argument and the column is left untouched. `undefined` means
 * "don't touch this column" — Prisma drops an `undefined` key from the write
 * rather than setting it to SQL NULL, which is what makes that safe.
 */
function toColumns(
  body: ServiceBody,
  resolved: { origin: string; destination: string; actualKm: number; serviceKm: number },
  rateCents?: number | null,
) {
  return {
    vehicleId: body.vehicleId,
    routeId: body.routeId,
    // SRS 14.5, 21.4: the snapshot is taken at write time, so a later edit to
    // the route master cannot rewrite this service's history.
    originSnapshot: resolved.origin,
    destinationSnapshot: resolved.destination,
    startDashboardKm: body.startDashboardKm,
    startBaseKm: body.startBaseKm,
    endBaseKm: body.endBaseKm,
    endDashboardKm: body.endDashboardKm,
    actualKm: resolved.actualKm,
    serviceKm: resolved.serviceKm,
    departureTime: timeOfDayToDate(body.departureTime as TimeOfDay),
    arrivalTime: timeOfDayToDate(body.arrivalTime as TimeOfDay),
    endsNextDay: body.endsNextDay,
    sites: body.sites ?? null,
    observations: body.observations ?? null,
    // `supplementCents` is never part of `rateCents === undefined`'s "leave
    // alone" case: a service has no supplement until an administrator sets
    // one (ERP roadmap Phase 4), so whenever `rateCents` *is* being written -
    // creation - `baseCents` is simply that rate, supplement absent.
    ...(rateCents === undefined ? {} : { rateCents, baseCents: computeBaseCents(rateCents, null) }),
  };
}

export const serviceService = {
  /**
   * Everything the Add Service screen preselects (SRS 9.2, 18.3).
   *
   * SRS 24.2 requires an actionable message when a driver is not configured,
   * rather than a form that cannot be submitted. Both cases below say what an
   * administrator needs to do.
   */
  async getContext(actor: Actor, forDriverId?: string): Promise<ServiceContext> {
    // An administrator may prepare the form for a driver (client decision #7);
    // a driver only ever gets their own.
    const driverId = actor.role === Role.ADMIN && forDriverId ? forDriverId : actor.userId;

    if (!canCreateFor(actor, driverId)) throw forbidden();

    const driver = await userRepository.findById(driverId);
    if (!driver || driver.role !== Role.DRIVER) throw notFound();
    if (!driver.isActive) throw businessRuleViolation(ERRORS.driverInactive);

    const [assignments, vehicles] = await Promise.all([
      userRepository.listAssignableRoutes(driverId),
      vehicleRepository.list({ isActive: true }),
    ]);

    if (assignments.length === 0) throw configurationRequired(ERRORS.noDefaultRoute);
    if (vehicles.length === 0) throw configurationRequired(ERRORS.noActiveVehicles);

    const defaultAssignment = assignments.find((assignment) => assignment.isDefault);

    // A deactivated default vehicle must not be preselected, but it is not a
    // blocker either: SRS 12.5 lets the driver pick any active vehicle.
    const defaultVehicleId =
      driver.defaultVehicleId &&
      vehicles.some((vehicle) => vehicle.id === driver.defaultVehicleId)
        ? driver.defaultVehicleId
        : null;

    return {
      driver: { id: driver.id, name: driver.name },
      serviceDate: currentBusinessDate(env.APP_TIMEZONE),
      defaultVehicleId,
      vehicles: vehicles.map((vehicle) => ({
        id: vehicle.id,
        registrationPlate: vehicle.registrationPlate,
        referenceName: vehicle.referenceName,
      })),
      routes: assignments.map((assignment) => ({
        ...assignment.route,
        isDefault: assignment.isDefault,
      })),
      defaultRouteId: defaultAssignment?.route.id ?? null,
    };
  },

  /**
   * Creates a service in `PENDING_APPROVAL` (SRS 9.6, 11.2).
   *
   * `body.driverId` is present only when an administrator is filing on a
   * driver's behalf; the driver's own schema has no such field, so for a driver
   * the owner is always the session user (SRS 9.5).
   */
  async create(
    actor: Actor,
    body: CreateServiceInput | AdminCreateServiceInput,
  ): Promise<ServiceWithRelations> {
    const driverId = 'driverId' in body ? body.driverId : actor.userId;

    if (!canCreateFor(actor, driverId)) throw forbidden();

    const driver = await userRepository.findById(driverId);
    if (!driver) throw notFound();
    if (driver.role !== Role.DRIVER) throw businessRuleViolation(ERRORS.userNotDriver);
    if (!driver.isActive) throw businessRuleViolation(ERRORS.driverInactive);

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const resolved = await resolveBody(tx, driverId, body);

        // SRS 9.2: the Service ID and the business date are server-generated.
        const sequence = await serviceRepository.nextServiceSequence(tx);

        const created = await serviceRepository.create(
          {
            serviceCode: formatServiceCode(sequence),
            serviceDate: currentBusinessDate(env.APP_TIMEZONE),
            driverId,
            status: PrismaServiceStatus.PENDING_APPROVAL,
            // Always snapshotted from the route's current default, for both a
            // driver's own submission and an administrator filing on their
            // behalf — there is no field either request schema could use to
            // override it (client change request 2026-09-09).
            ...toColumns(body, resolved, resolved.routeDefaultRateCents),
          } satisfies Prisma.ServiceUncheckedCreateInput,
          tx,
        );

        // SRS 21.2: the initial transition, so history is complete from the
        // first row rather than starting at the first approval.
        await serviceRepository.recordStatusChange(
          {
            serviceId: created.id,
            fromStatus: null,
            toStatus: PrismaServiceStatus.PENDING_APPROVAL,
            changedByUserId: actor.userId,
          },
          tx,
        );

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.SERVICE,
          entityId: created.id,
          action: AuditAction.CREATE,
          after: {
            serviceCode: created.serviceCode,
            driverId: created.driverId,
            // Recorded explicitly: for an administrator-filed service the actor
            // and the owner differ, and "who entered this" must stay answerable
            // (SRS 21.1, client decision #7).
            filedByAdministrator: actor.userId !== driverId,
            vehicleId: created.vehicleId,
            routeId: created.routeId,
            actualKm: created.actualKm,
            serviceKm: created.serviceKm,
          },
        });

        // Not an SRS requirement — see the schema comment on `Notification` —
        // but committed in the same transaction as everything above, so an
        // administrator is never left unnotified of a service that did in
        // fact get created.
        await notificationService.notifyAdminsOfPendingService(tx, {
          serviceId: created.id,
          actorUserId: actor.userId,
        });

        return created;
      }),
    );
  },

  /**
   * Edits a service, recalculating mileage (SRS 10.4, 11.2, 21.3).
   *
   * The pending path uses a status-guarded update so an approval landing
   * between the driver's page load and their save cannot be overwritten — the
   * SRS 24.4 conflict, closed at the database rather than in a check-then-act
   * pair.
   */
  async update(
    actor: Actor,
    id: string,
    body: UpdateServiceInput,
  ): Promise<ServiceWithRelations> {
    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const existing = await loadForEdit(tx, id, actor);
        const resolved = await resolveBody(tx, existing.driverId, body);
        const columns = toColumns(body, resolved);

        const updated =
          existing.status === PrismaServiceStatus.PENDING_APPROVAL
            ? await serviceRepository.updateIfStatus(
                id,
                PrismaServiceStatus.PENDING_APPROVAL,
                columns,
                tx,
              )
            : // An administrator editing an approved service (SRS 11.4). The
              // status is unchanged by the write, so there is no race to guard.
              await serviceRepository.update(id, columns, tx);

        if (!updated) throw conflict(ERRORS.serviceApprovedDuringEdit);

        const changes = diffForAudit(
          existing as unknown as Record<string, unknown>,
          columns as unknown as Record<string, unknown>,
        );

        if (changes) {
          await writeAudit(tx, {
            actorUserId: actor.userId,
            entityType: AuditEntityType.SERVICE,
            entityId: id,
            action: AuditAction.UPDATE,
            before: changes.before,
            after: {
              ...changes.after,
              // SRS 21.3: an edit after approval is worth flagging in the log,
              // not merely recording.
              editedAfterApproval: existing.status === PrismaServiceStatus.APPROVED,
            },
          });
        }

        return updated;
      }),
    );
  },

  /**
   * Sets or clears a service's rate (client change request 2026-09-09, ERP
   * roadmap Phase 0).
   *
   * Admin-only, and deliberately outside `canEdit`: the rate is information a
   * driver never sees or edits, so a driver's own pending/approved rules don't
   * apply here the way they do to `update()` — an administrator may correct
   * the rate on a service in either status, most commonly while reviewing a
   * pending one just before approving it.
   */
  async updateRate(
    actor: Actor,
    id: string,
    rateCents: number | null,
  ): Promise<ServiceWithRelations> {
    if (actor.role !== Role.ADMIN) throw forbidden();

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const existing = await serviceRepository.findByIdForActor(id, actor, tx);
        if (!existing) throw notFound();

        // `baseCents` depends on `rateCents` (ERP roadmap Phase 4's "Base
        // imponible = tarifa + suplemento"), so a rate change always
        // recomputes it from the supplement already on the row - which this
        // call never touches.
        const baseCents = computeBaseCents(rateCents, existing.supplementCents);

        const updated = await serviceRepository.update(id, { rateCents, baseCents }, tx);

        if (existing.rateCents !== updated.rateCents) {
          await writeAudit(tx, {
            actorUserId: actor.userId,
            entityType: AuditEntityType.SERVICE,
            entityId: id,
            action: AuditAction.UPDATE,
            before: { rateCents: existing.rateCents, baseCents: existing.baseCents },
            after: { rateCents: updated.rateCents, baseCents: updated.baseCents },
          });
        }

        return updated;
      }),
    );
  },

  /**
   * Sets or clears a service's supplement (ERP roadmap Phase 4) — the
   * roadmap's "Imp. suplemento", an extra charge for waiting time, an extra
   * stop, night or holiday work. Same admin-only, outside-`canEdit` shape as
   * `updateRate`, and always recomputes `baseCents` from whatever rate is
   * already on the row, for the same reason `updateRate` recomputes it from
   * whatever supplement is already there.
   */
  async updateSupplement(
    actor: Actor,
    id: string,
    input: { supplementCents: number | null; supplementTypeId: string | null | undefined },
  ): Promise<ServiceWithRelations> {
    if (actor.role !== Role.ADMIN) throw forbidden();

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const existing = await serviceRepository.findByIdForActor(id, actor, tx);
        if (!existing) throw notFound();

        const baseCents = computeBaseCents(existing.rateCents, input.supplementCents);

        const updated = await serviceRepository.update(
          id,
          {
            supplementCents: input.supplementCents,
            ...(input.supplementTypeId === undefined
              ? {}
              : { supplementTypeId: input.supplementTypeId }),
            baseCents,
          },
          tx,
        );

        const changes = diffForAudit(
          {
            supplementCents: existing.supplementCents,
            supplementTypeId: existing.supplementTypeId,
            baseCents: existing.baseCents,
          },
          {
            supplementCents: updated.supplementCents,
            supplementTypeId: updated.supplementTypeId,
            baseCents: updated.baseCents,
          },
        );

        if (changes) {
          await writeAudit(tx, {
            actorUserId: actor.userId,
            entityType: AuditEntityType.SERVICE,
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

  /**
   * Approves a pending service (SRS 11.3).
   *
   * Status, approval metadata, the history row and the audit entry are written
   * in one transaction. The `services_approval_metadata_consistent` CHECK
   * constraint means a partial write could not commit even if this were wrong.
   */
  async approve(actor: Actor, id: string): Promise<ServiceWithRelations> {
    if (actor.role !== Role.ADMIN) throw forbidden();

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const existing = await serviceRepository.findByIdForActor(id, actor, tx);
        if (!existing) throw notFound();

        if (!canApprove(actor, { driverId: existing.driverId, status: existing.status })) {
          // The only way to reach this in V1 is an already-approved service, so
          // 409 with a specific message beats a generic 403.
          throw conflict(ERRORS.alreadyApproved);
        }

        const approvedAt = new Date();

        // Status-guarded, so two administrators approving simultaneously cannot
        // both succeed and write two history rows.
        const approved = await serviceRepository.updateIfStatus(
          id,
          PrismaServiceStatus.PENDING_APPROVAL,
          {
            status: PrismaServiceStatus.APPROVED,
            approvedAt,
            approvedByUserId: actor.userId,
          },
          tx,
        );

        if (!approved) throw conflict(ERRORS.alreadyApproved);

        await serviceRepository.recordStatusChange(
          {
            serviceId: id,
            fromStatus: PrismaServiceStatus.PENDING_APPROVAL,
            toStatus: PrismaServiceStatus.APPROVED,
            changedByUserId: actor.userId,
          },
          tx,
        );

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.SERVICE,
          entityId: id,
          action: AuditAction.APPROVE,
          before: { status: ServiceStatus.PENDING_APPROVAL },
          after: {
            status: ServiceStatus.APPROVED,
            approvedAt,
            approvedByUserId: actor.userId,
          },
        });

        // Same reasoning as the notification on create: committed with the
        // approval itself, so the driver learns exactly when the record says
        // they were approved, not some later moment a background job got to it.
        await notificationService.notifyDriverOfApproval(tx, {
          serviceId: id,
          driverId: existing.driverId,
        });

        return approved;
      }),
    );
  },

  /** One service, scoped to what this actor may see (SRS 9.7). */
  async getById(actor: Actor, id: string): Promise<ServiceWithRelations> {
    const service = await serviceRepository.findByIdForActor(id, actor);
    if (!service) throw notFound();
    return service;
  },

  /**
   * A filtered page (SRS 16.3).
   *
   * A driver's filters are honoured except for `driverId`, which the repository
   * overwrites with their own id — so the same endpoint serves both roles
   * without a second code path (SRS 9.7).
   */
  async list(
    actor: Actor,
    filters: ServiceFilterInput,
  ): Promise<{ items: ServiceWithRelations[]; total: number; pagination: Pagination }> {
    const pagination: Pagination = { page: filters.page, pageSize: filters.pageSize };

    const { items, total } = await serviceRepository.list(
      {
        q: filters.q,
        driverId: filters.driverId,
        vehicleId: filters.vehicleId,
        routeId: filters.routeId,
        status: filters.status,
        dateFrom: filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00.000Z`) : null,
        dateTo: filters.dateTo ? new Date(`${filters.dateTo}T00:00:00.000Z`) : null,
      },
      actor,
      toPrismaPagination(pagination),
    );

    return { items, total, pagination };
  },

  /** Status history for the detail view (SRS 16.4, 21.2). */
  async getStatusHistory(actor: Actor, id: string) {
    // Re-checks visibility rather than trusting the caller to have done so.
    await this.getById(actor, id);
    return serviceRepository.listStatusHistory(id);
  },
} as const;
