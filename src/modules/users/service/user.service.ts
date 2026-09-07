/**
 * User and driver administration (SRS 12, 18.4, 21.5).
 *
 * Every function here is administrator-only, and every one re-checks that
 * rather than trusting the route it was reached through (SRS 8.3).
 */
import type { Deletability } from '@/modules/shared/deletability';
import { toDeletability } from '@/modules/shared/deletability';
import type { Pagination } from '@/modules/shared/schemas/common';
import { Role as PrismaRole } from '@prisma/client';

import {
  AuditAction,
  AuditEntityType,
  diffForAudit,
  writeAudit,
} from '@/lib/audit/audit-service';
import { hashPassword } from '@/lib/auth/password';
import type { Actor } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { withTranslatedErrors } from '@/lib/db/with-translated-errors';
import { businessRuleViolation, forbidden, notFound } from '@/lib/errors/app-error';
import { ERRORS } from '@/lib/i18n/messages';
import { Role } from '@/modules/services/domain/service-status';
import { vehicleRepository } from '@/modules/vehicles/repository/vehicle.repository';
import { userRepository, type UserWithRelations } from '../repository/user.repository';
import type {
  CreateUserInput,
  ReplaceRouteAssignmentsInput,
  UpdateUserInput,
} from '../schemas/user.schema';

function assertAdmin(actor: Actor): void {
  if (actor.role !== Role.ADMIN) throw forbidden();
}

/**
 * A driver's default vehicle must exist and be active.
 *
 * Not enforceable by a foreign key — the FK guarantees the vehicle exists, not
 * that it is selectable — so it is checked here and on every service write.
 */
async function assertVehicleUsable(vehicleId: string | null | undefined): Promise<void> {
  if (!vehicleId) return;
  const usable = await vehicleRepository.isSelectable(vehicleId);
  if (!usable) throw businessRuleViolation(ERRORS.vehicleInactive);
}

/**
 * Route assignments belong to drivers only.
 *
 * SRS 19.6 defines `driver_routes.driver_id` as referencing a user with the
 * DRIVER role. PostgreSQL cannot express "foreign key to rows where role =
 * DRIVER", so the rule lives here and in the request schema.
 */
async function assertRoutesUsable(routeIds: string[]): Promise<void> {
  if (routeIds.length === 0) return;

  const found = await prisma.route.findMany({
    where: { id: { in: routeIds } },
    select: { id: true, isActive: true },
  });

  if (found.length !== routeIds.length) throw notFound();

  // SRS 14.2 allows deactivating a route; assigning an already-inactive one is
  // a different thing, and would produce a driver whose picker silently omits
  // a route the admin believes they granted.
  if (found.some((route) => !route.isActive)) {
    throw businessRuleViolation(ERRORS.routeInactive);
  }
}

export const userService = {
  async list(
    actor: Actor,
    filters: { role?: Role | undefined; isActive?: boolean | undefined } = {},
  ): Promise<UserWithRelations[]> {
    assertAdmin(actor);
    return userRepository.list({
      ...(filters.role ? { role: filters.role as PrismaRole } : {}),
      ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }),
    });
  },

  /**
   * One page of the list. Same authorisation, same scoping, same ordering as
   * `list` — the only difference is that a screen gets a bounded slice and the
   * count it needs to draw the pager.
   */
  async listPage(
    actor: Actor,
    filters: { role?: Role | undefined; isActive?: boolean | undefined; q?: string },
    pagination: Pagination,
  ): Promise<{ items: UserWithRelations[]; total: number }> {
    assertAdmin(actor);
    return userRepository.listPage(
      {
        ...(filters.role ? { role: filters.role as PrismaRole } : {}),
        ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }),
        ...(filters.q !== undefined ? { q: filters.q } : {}),
      },
      pagination,
    );
  },

  /** Whether this account can be deleted, for the screen that offers it. */
  async getDeletability(actor: Actor, id: string): Promise<Deletability> {
    assertAdmin(actor);

    // Your own account is never deletable, whatever its history looks like:
    // an administrator locking themselves out mid-session is not recoverable
    // from inside the application.
    if (actor.userId === id) {
      return { canDelete: false, blockers: [], cascades: [] };
    }

    const counts = await userRepository.countDependents(id);
    const assignments = await userRepository.countRouteAssignments(id);
    return toDeletability(counts, { routeAssignments: assignments });
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
    if (actor.userId === id) throw businessRuleViolation(ERRORS.deleteSelfBlocked);

    const existing = await userRepository.findById(id);
    if (!existing) throw notFound();

    await withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const counts = await userRepository.countDependents(id, tx);
        if (!toDeletability(counts).canDelete) {
          throw businessRuleViolation(ERRORS.deleteBlocked);
        }

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.USER,
          entityId: id,
          action: AuditAction.DELETE,
          // `redactAuditPayload` strips the hash, and `USER_SELECT` never
          // loaded one in the first place.
          before: existing,
        });

        await userRepository.delete(id, tx);
      }),
    );
  },

  async getById(actor: Actor, id: string): Promise<UserWithRelations> {
    assertAdmin(actor);
    const user = await userRepository.findById(id);
    if (!user) throw notFound();
    return user;
  },

  /**
   * Creates an account, optionally configured in the same step (SRS 12.2).
   *
   * The account, its default vehicle and its route assignments are one
   * transaction: a driver who exists but whose routes failed to save is exactly
   * the half-configured state SRS 24.2 has to apologise for later.
   */
  async create(actor: Actor, input: CreateUserInput): Promise<UserWithRelations> {
    assertAdmin(actor);

    await assertVehicleUsable(input.defaultVehicleId);
    await assertRoutesUsable(input.assignments.map((assignment) => assignment.routeId));

    // Hashed outside the transaction: Argon2id is deliberately slow, and
    // holding a database transaction open for ~50 ms of CPU work is wasteful.
    const passwordHash = await hashPassword(input.password);

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const created = await userRepository.create(
          {
            name: input.name,
            loginIdentifier: input.loginIdentifier,
            passwordHash,
            role: input.role as PrismaRole,
            isActive: input.isActive,
            defaultVehicleId: input.defaultVehicleId ?? null,
          },
          tx,
        );

        if (input.assignments.length > 0) {
          await userRepository.replaceRouteAssignments(created.id, input.assignments, tx);
        }

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.USER,
          entityId: created.id,
          action: AuditAction.CREATE,
          // `password` and `passwordHash` are absent, and `redactAuditPayload`
          // would strip them anyway (SRS 19.9, 22.7).
          after: {
            name: created.name,
            loginIdentifier: created.loginIdentifier,
            role: created.role,
            isActive: created.isActive,
            defaultVehicleId: created.defaultVehicleId,
            assignedRouteCount: input.assignments.length,
          },
        });

        return userRepository.findById(created.id, tx) as Promise<UserWithRelations>;
      }),
    );
  },

  /**
   * Edits an account (SRS 12.3, 12.4).
   *
   * `password` is optional and, when present, replaces the hash — the client
   * resets forgotten passwords themselves (`docs/open-questions.md` #5).
   */
  async update(actor: Actor, id: string, input: UpdateUserInput): Promise<UserWithRelations> {
    assertAdmin(actor);

    const existing = await userRepository.findById(id);
    if (!existing) throw notFound();

    // An administrator locking themselves out is recoverable only by another
    // administrator, and a two-person deployment may not have one.
    if (id === actor.userId && input.isActive === false) {
      throw businessRuleViolation(ERRORS.cannotDeactivateSelf);
    }
    if (id === actor.userId && input.role === Role.DRIVER) {
      throw businessRuleViolation(ERRORS.cannotDemoteSelf);
    }

    // Demoting an administrator to driver, or promoting a driver, changes what
    // the route assignments mean. SRS 3.2 gives administrators neither, so the
    // configuration is cleared rather than left dangling.
    const becomingAdmin = input.role === Role.ADMIN && existing.role !== PrismaRole.ADMIN;

    if (input.defaultVehicleId) await assertVehicleUsable(input.defaultVehicleId);

    const passwordHash = input.password ? await hashPassword(input.password) : undefined;

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const updated = await userRepository.update(
          id,
          {
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.loginIdentifier === undefined
              ? {}
              : { loginIdentifier: input.loginIdentifier }),
            ...(passwordHash === undefined ? {} : { passwordHash }),
            ...(input.role === undefined ? {} : { role: input.role as PrismaRole }),
            ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
            ...(input.defaultVehicleId === undefined
              ? {}
              : { defaultVehicleId: input.defaultVehicleId }),
            ...(becomingAdmin ? { defaultVehicleId: null } : {}),
          },
          tx,
        );

        if (becomingAdmin) {
          await userRepository.replaceRouteAssignments(id, [], tx);
        }

        const changes = diffForAudit(
          existing as unknown as Record<string, unknown>,
          {
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.loginIdentifier === undefined
              ? {}
              : { loginIdentifier: input.loginIdentifier }),
            ...(input.role === undefined ? {} : { role: input.role }),
            ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
            ...(input.defaultVehicleId === undefined
              ? {}
              : { defaultVehicleId: input.defaultVehicleId }),
          } as Record<string, unknown>,
        );

        const passwordChanged = passwordHash !== undefined;

        if (changes || passwordChanged) {
          await writeAudit(tx, {
            actorUserId: actor.userId,
            entityType: AuditEntityType.USER,
            entityId: id,
            action:
              input.isActive === true
                ? AuditAction.ACTIVATE
                : input.isActive === false
                  ? AuditAction.DEACTIVATE
                  : AuditAction.UPDATE,
            ...(changes ? { before: changes.before } : {}),
            after: {
              ...(changes?.after ?? {}),
              // Recorded as a fact, never as a value (SRS 22.7).
              ...(passwordChanged ? { passwordReset: true } : {}),
            },
          });
        }

        return updated;
      }),
    );
  },

  /**
   * Replaces a driver's route assignments (SRS 12.6, 18.4).
   *
   * A full replacement rather than add/remove endpoints: "exactly one default"
   * is a property of the whole set, and enforcing it across a sequence of
   * individual mutations means every intermediate state must also be legal,
   * which it cannot be while the default is being moved.
   */
  async replaceRouteAssignments(
    actor: Actor,
    driverId: string,
    input: ReplaceRouteAssignmentsInput,
  ): Promise<UserWithRelations> {
    assertAdmin(actor);

    const driver = await userRepository.findById(driverId);
    if (!driver) throw notFound();
    if (driver.role !== PrismaRole.DRIVER) throw businessRuleViolation(ERRORS.userNotDriver);

    await assertRoutesUsable(input.assignments.map((assignment) => assignment.routeId));

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const before = driver.routeAssignments.map((assignment) => ({
          routeId: assignment.routeId,
          isDefault: assignment.isDefault,
        }));

        await userRepository.replaceRouteAssignments(driverId, input.assignments, tx);

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.DRIVER_ROUTE,
          entityId: driverId,
          action: AuditAction.ASSIGN_ROUTES,
          before: { assignments: before },
          after: { assignments: input.assignments },
        });

        return userRepository.findById(driverId, tx) as Promise<UserWithRelations>;
      }),
    );
  },
} as const;
