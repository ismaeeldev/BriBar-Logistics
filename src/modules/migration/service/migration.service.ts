/**
 * The one-time ERP data import (roadmap Phase 7, §3.5).
 *
 * Admin-only. Reads a bundle — one array of rows per source sheet, already
 * shaped to the app's own conventions (ISO dates, euro strings, references by
 * name) — validates every row against the module `createXSchema` the forms
 * use, and reports what would be rejected. Writes nothing unless
 * `commit: true` *and* every row planned cleanly.
 *
 * This is the entire bridge from the spreadsheet (roadmap §3.6): it runs once
 * per environment, dry-run first, and after cutover Excel is a frozen
 * archive. There is no ongoing sync.
 */
import type { Actor } from '@/lib/auth/session';
import { forbidden } from '@/lib/errors/app-error';
import { configService } from '@/modules/config/service/config.service';
import { updateConfigSchema } from '@/modules/config/schemas/config.schema';
import { Role } from '@/modules/services/domain/service-status';
import type { ImportPlan } from '../domain/import-plan';
import { ALL_IMPORTERS } from './importers';
import { runImport } from './importer';

function assertAdmin(actor: Actor): void {
  if (actor.role !== Role.ADMIN) throw forbidden();
}

export interface MigrationResult {
  plan: ImportPlan;
  committed: boolean;
  /** `99_Config`: what the operational defaults were set to, if the bundle carried them. */
  config: { applied: boolean; errors: string[] };
}

/** Maps the `config` sheet's single row onto `updateConfigSchema`. */
function planConfig(bundle: Record<string, unknown>): {
  input?: ReturnType<typeof updateConfigSchema.parse>;
  errors: string[];
} {
  const raw = bundle['config'];
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== 'object') return { errors: [] };

  const source = row as Record<string, unknown>;
  const parsed = updateConfigSchema.safeParse({
    oilChangeIntervalKm: String(source['oilChangeIntervalKm'] ?? '').trim(),
    defaultConsumption: String(source['defaultConsumption'] ?? '').trim(),
    defaultFuelPrice: String(source['defaultFuelPrice'] ?? '').trim(),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.issues.map((issue) => `config.${issue.path.join('.')}: ${issue.message}`),
    };
  }
  return { input: parsed.data, errors: [] };
}

export const migrationService = {
  async run(
    actor: Actor,
    bundle: Record<string, unknown>,
    { commit }: { commit: boolean },
  ): Promise<MigrationResult> {
    assertAdmin(actor);

    const config = planConfig(bundle);
    const { plan, committed } = await runImport(ALL_IMPORTERS, bundle, actor, {
      // Config errors block the commit too — the report shows both.
      commit: commit && config.errors.length === 0,
    });

    let configApplied = false;
    if (committed && config.input) {
      await configService.update(actor, config.input);
      configApplied = true;
    }

    return {
      plan,
      committed,
      config: { applied: configApplied, errors: config.errors },
    };
  },
} as const;
