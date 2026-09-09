/**
 * Operational-defaults administration (ERP roadmap Phase 1, `99_Config`).
 *
 * No `create`, no `remove`: the row is seeded once by the migration and
 * always exists (`configRepository.get`'s doc comment), so the only
 * operation this module offers is changing it.
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
import { forbidden } from '@/lib/errors/app-error';
import { Role } from '@/modules/services/domain/service-status';
import {
  APP_CONFIG_AUDIT_ID,
  configRepository,
  type AppConfigRecord,
} from '../repository/config.repository';
import type { UpdateConfigInput } from '../schemas/config.schema';

function assertAdmin(actor: Actor): void {
  if (actor.role !== Role.ADMIN) throw forbidden();
}

export const configService = {
  /**
   * Read-only for anyone signed in, not admin-only: Phase 2's refuelling
   * module and Phase 5's maintenance module will read these defaults from a
   * driver-facing form (a suggested consumption, a suggested fuel price),
   * not only from the admin settings screen. Nothing here is sensitive —
   * unlike a route's rate, these are operational constants, not pricing.
   */
  async get(): Promise<AppConfigRecord> {
    return configRepository.get();
  },

  async update(actor: Actor, input: UpdateConfigInput): Promise<AppConfigRecord> {
    assertAdmin(actor);

    const existing = await configRepository.get();

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const updated = await configRepository.update(
          {
            oilChangeIntervalKm: input.oilChangeIntervalKm,
            defaultConsumptionMlPer100Km: input.defaultConsumption,
            defaultFuelPriceCentsPerLiter: input.defaultFuelPrice,
          },
          tx,
        );

        const changes = diffForAudit(
          existing as unknown as Record<string, unknown>,
          {
            oilChangeIntervalKm: input.oilChangeIntervalKm,
            defaultConsumptionMlPer100Km: input.defaultConsumption,
            defaultFuelPriceCentsPerLiter: input.defaultFuelPrice,
          },
        );

        if (changes) {
          await writeAudit(tx, {
            actorUserId: actor.userId,
            entityType: AuditEntityType.APP_CONFIG,
            entityId: APP_CONFIG_AUDIT_ID,
            action: AuditAction.UPDATE,
            before: changes.before,
            after: changes.after,
          });
        }

        return updated;
      }),
    );
  },
} as const;
