/**
 * The shape of an import run's plan (ERP roadmap Phase 7, roadmap §3.5).
 *
 * The importer is **dry-run by default**: it produces this plan — every row
 * classified as a create, a skip (already present, so a re-run is safe) or an
 * error (validation or a reference that does not resolve) — and only writes
 * anything when explicitly told to commit. This file is the pure description
 * of that plan and the summary the report is built from; it imports nothing
 * (CLAUDE.md).
 */

export type RowOutcome = 'create' | 'skip' | 'error';

/** One row from one sheet, after planning. */
export interface PlannedRow {
  /** The source sheet, e.g. `tblRepostajes`. */
  sheet: string;
  /** 1-based row number within the sheet, for a report a human can act on. */
  rowNumber: number;
  /** The natural key that makes this row idempotent, e.g. a refuel code. */
  naturalKey: string;
  outcome: RowOutcome;
  /** Present when `outcome` is `error` — one line per problem. */
  errors: string[];
}

/** One entity type's slice of the plan. */
export interface EntityPlan {
  entity: string;
  sheet: string;
  rows: PlannedRow[];
}

export interface ImportPlan {
  entities: EntityPlan[];
}

export interface EntitySummary {
  entity: string;
  create: number;
  skip: number;
  error: number;
}

export interface ImportSummary {
  entities: EntitySummary[];
  totals: { create: number; skip: number; error: number };
  /** No row anywhere failed to plan — a commit will not be a partial write. */
  ok: boolean;
}

function countOutcome(rows: PlannedRow[], outcome: RowOutcome): number {
  return rows.filter((row) => row.outcome === outcome).length;
}

/** Rolls a plan up into the counts the report and the CLI exit code use. */
export function summarize(plan: ImportPlan): ImportSummary {
  const entities = plan.entities.map((entity) => ({
    entity: entity.entity,
    create: countOutcome(entity.rows, 'create'),
    skip: countOutcome(entity.rows, 'skip'),
    error: countOutcome(entity.rows, 'error'),
  }));

  const totals = entities.reduce(
    (acc, entity) => ({
      create: acc.create + entity.create,
      skip: acc.skip + entity.skip,
      error: acc.error + entity.error,
    }),
    { create: 0, skip: 0, error: 0 },
  );

  return { entities, totals, ok: totals.error === 0 };
}

/** Every error line in the plan, prefixed with its sheet and row. */
export function collectErrors(plan: ImportPlan): string[] {
  return plan.entities.flatMap((entity) =>
    entity.rows
      .filter((row) => row.outcome === 'error')
      .flatMap((row) => row.errors.map((error) => `${row.sheet}:${row.rowNumber} — ${error}`)),
  );
}
