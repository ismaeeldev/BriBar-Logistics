/**
 * Route/contract administration (SRS 14, 21.4, 21.5).
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
import { routeRepository, type RouteRecord } from '../repository/route.repository';
import type { CreateRouteInput, UpdateRouteInput } from '../schemas/route.schema';

function assertAdmin(actor: Actor): void {
  if (actor.role !== Role.ADMIN) throw forbidden();
}

export const routeService = {
  /**
   * Administrator-only, unlike the vehicle list.
   *
   * A driver never needs the full route catalogue — SRS 14.3 restricts them to
   * routes assigned to them, which the Add Service context supplies. Exposing
   * every route here would leak the client's contract list to any signed-in
   * driver for no operational gain.
   */
  async list(
    actor: Actor,
    filters: { isActive?: boolean | undefined } = {},
  ): Promise<RouteRecord[]> {
    assertAdmin(actor);
    return routeRepository.list(filters);
  },

  async getById(actor: Actor, id: string): Promise<RouteRecord> {
    assertAdmin(actor);
    const route = await routeRepository.findById(id);
    if (!route) throw notFound();
    return route;
  },

  async create(actor: Actor, input: CreateRouteInput): Promise<RouteRecord> {
    assertAdmin(actor);

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const created = await routeRepository.create(
          {
            code: input.code,
            name: input.name,
            origin: input.origin,
            destination: input.destination,
            isActive: input.isActive,
          },
          tx,
        );

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.ROUTE,
          entityId: created.id,
          action: AuditAction.CREATE,
          after: created,
        });

        return created;
      }),
    );
  },

  /**
   * Edits a route, origin and destination included (SRS 14.2).
   *
   * Nothing here touches existing services, and that is the point. SRS 21.4
   * requires historical services not to change when route master data does;
   * each service carries its own origin/destination snapshot, so this update
   * affects only services created *after* it.
   *
   * The audit entry matters more than usual here. When someone later asks why
   * service 1247 says "Nave Getafe" while the route now says "Almacén Toledo",
   * this row is the answer.
   */
  async update(actor: Actor, id: string, input: UpdateRouteInput): Promise<RouteRecord> {
    assertAdmin(actor);

    const existing = await routeRepository.findById(id);
    if (!existing) throw notFound();

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const updated = await routeRepository.update(
          id,
          {
            ...(input.code === undefined ? {} : { code: input.code }),
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.origin === undefined ? {} : { origin: input.origin }),
            ...(input.destination === undefined ? {} : { destination: input.destination }),
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
            entityType: AuditEntityType.ROUTE,
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

  /**
   * How many drivers hold this route.
   *
   * Deactivating a route silently removes it from those drivers' pickers. The
   * admin UI uses this to say how many people the change affects before it is
   * made, rather than after someone reports a missing route.
   */
  async countAssignedDrivers(actor: Actor, id: string): Promise<number> {
    assertAdmin(actor);
    return routeRepository.countAssignedDrivers(id);
  },
} as const;
