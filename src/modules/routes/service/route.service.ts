/**
 * Route/contract administration (SRS 14, 21.4, 21.5).
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
import { clientRepository } from '@/modules/clients/repository/client.repository';
import { Role } from '@/modules/services/domain/service-status';
import { routeRepository, type RouteRecord } from '../repository/route.repository';
import type { CreateRouteInput, UpdateRouteInput } from '../schemas/route.schema';

function assertAdmin(actor: Actor): void {
  if (actor.role !== Role.ADMIN) throw forbidden();
}

/** ERP roadmap Phase 4: confirms a chosen client actually exists before a
 * route is tied to it. Not gated on `isActive` — an inactive client keeping
 * its existing route link is fine; only linking a *new* route to a client
 * that has never existed is the mistake worth catching here. */
async function assertClientExists(clientId: string | null | undefined): Promise<void> {
  if (!clientId) return;
  const client = await clientRepository.findById(clientId);
  if (!client) throw notFound();
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

  /**
   * One page of the list. Same authorisation, same scoping, same ordering as
   * `list` — the only difference is that a screen gets a bounded slice and the
   * count it needs to draw the pager.
   */
  async listPage(
    actor: Actor,
    filters: { isActive?: boolean | undefined; q?: string },
    pagination: Pagination,
  ): Promise<{ items: RouteRecord[]; total: number }> {
    assertAdmin(actor);
    return routeRepository.listPage(filters, pagination);
  },

  async getById(actor: Actor, id: string): Promise<RouteRecord> {
    assertAdmin(actor);
    const route = await routeRepository.findById(id);
    if (!route) throw notFound();
    return route;
  },

  /** Whether this route can be deleted, for the screen that offers it. */
  async getDeletability(actor: Actor, id: string): Promise<Deletability> {
    assertAdmin(actor);
    const { services, assignedDrivers, dailyKmLogs } = await routeRepository.countDependents(id);
    return toDeletability({ services, dailyKmLogs }, { routeAssignments: assignedDrivers });
  },

  /**
   * Deletes the record, if nothing depends on it.
   *
   * The check is re-run inside the transaction rather than trusted from the
   * page that drew the button: between the render and the click, a driver may
   * have filed a service against it. `withTranslatedErrors` then catches the
   * foreign-key violation as a last line of defence, so even a race that beats
   * the re-check produces a sentence rather than a stack trace.
   */
  async remove(actor: Actor, id: string): Promise<void> {
    assertAdmin(actor);

    const existing = await routeRepository.findById(id);
    if (!existing) throw notFound();

    await withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const { services, dailyKmLogs } = await routeRepository.countDependents(id, tx);
        if (services > 0 || dailyKmLogs > 0) throw businessRuleViolation(ERRORS.deleteBlocked);

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.ROUTE,
          entityId: id,
          action: AuditAction.DELETE,
          before: existing,
        });

        await routeRepository.delete(id, tx);
      }),
    );
  },

  async create(actor: Actor, input: CreateRouteInput): Promise<RouteRecord> {
    assertAdmin(actor);
    await assertClientExists(input.clientId);

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const created = await routeRepository.create(
          {
            code: input.code,
            name: input.name,
            origin: input.origin,
            destination: input.destination,
            isActive: input.isActive,
            defaultRateCents: input.defaultRate ?? null,
            clientId: input.clientId ?? null,
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
    if (input.clientId !== undefined) await assertClientExists(input.clientId);

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
            // `moneySchema`/`clearableUuidSchema` both reserve `null` for
            // "clear the field", distinct from `undefined` ("field not sent,
            // leave alone") — see their doc comments.
            ...(input.defaultRate === undefined ? {} : { defaultRateCents: input.defaultRate }),
            ...(input.clientId === undefined ? {} : { clientId: input.clientId }),
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
