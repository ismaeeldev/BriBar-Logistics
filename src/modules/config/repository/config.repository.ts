/**
 * Database access for the single operational-defaults row (ERP roadmap
 * Phase 1, `99_Config`).
 */
import type { Prisma } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';

/** The fixed, application-known id — see the doc comment on `AppConfig`. */
export const APP_CONFIG_ID = 'default';

/**
 * The value `writeAudit` records against — `audit_logs.entity_id` is a
 * `Uuid` column (every other audited entity has a UUID primary key), and
 * `AppConfig.id` deliberately is not one (it is the human-readable constant
 * `"default"` — see the model's doc comment). The nil UUID stands in for
 * "the one config row" without pretending it is a generated id.
 */
export const APP_CONFIG_AUDIT_ID = '00000000-0000-0000-0000-000000000000';

const CONFIG_SELECT = {
  id: true,
  oilChangeIntervalKm: true,
  defaultConsumptionMlPer100Km: true,
  defaultFuelPriceCentsPerLiter: true,
  updatedAt: true,
} satisfies Prisma.AppConfigSelect;

export type AppConfigRecord = Prisma.AppConfigGetPayload<{ select: typeof CONFIG_SELECT }>;

export const configRepository = {
  /**
   * The migration seeds this row, so a missing one is a deployment that
   * skipped it rather than a state the application should paper over —
   * `findUniqueOrThrow` says so plainly instead of returning schema defaults
   * that would silently diverge from what a fresh `prisma migrate deploy`
   * actually produces.
   */
  async get(client: PrismaClientLike = prisma): Promise<AppConfigRecord> {
    return client.appConfig.findUniqueOrThrow({
      where: { id: APP_CONFIG_ID },
      select: CONFIG_SELECT,
    });
  },

  async update(
    data: Prisma.AppConfigUpdateInput,
    client: PrismaClientLike = prisma,
  ): Promise<AppConfigRecord> {
    return client.appConfig.update({
      where: { id: APP_CONFIG_ID },
      data,
      select: CONFIG_SELECT,
    });
  },
} as const;

export type ConfigRepository = typeof configRepository;
