/**
 * The dry-run report (ERP roadmap Phase 7, roadmap §3.5: "reports what would
 * be rejected").
 *
 * Plain text, built from an {@link ImportPlan}, so the CLI can print it and a
 * test can assert on it. No imports (CLAUDE.md).
 */
import { collectErrors, summarize, type ImportPlan } from './import-plan';

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

export function formatReport(plan: ImportPlan, { committed }: { committed: boolean }): string {
  const summary = summarize(plan);
  const lines: string[] = [];

  lines.push(committed ? 'ERP import — COMMITTED' : 'ERP import — DRY RUN (nothing written)');
  lines.push('');

  const nameWidth = Math.max(6, ...summary.entities.map((entity) => entity.entity.length));
  lines.push(
    `${pad('entity', nameWidth)}  ${pad('create', 8)}${pad('skip', 8)}${pad('error', 8)}`,
  );
  lines.push('-'.repeat(nameWidth + 26));

  for (const entity of summary.entities) {
    lines.push(
      `${pad(entity.entity, nameWidth)}  ${pad(String(entity.create), 8)}${pad(
        String(entity.skip),
        8,
      )}${pad(String(entity.error), 8)}`,
    );
  }

  lines.push('-'.repeat(nameWidth + 26));
  lines.push(
    `${pad('total', nameWidth)}  ${pad(String(summary.totals.create), 8)}${pad(
      String(summary.totals.skip),
      8,
    )}${pad(String(summary.totals.error), 8)}`,
  );

  const errors = collectErrors(plan);
  if (errors.length > 0) {
    lines.push('');
    lines.push(`${errors.length} row(s) could not be planned:`);
    for (const error of errors) lines.push(`  ${error}`);
    lines.push('');
    lines.push('Fix the source rows and re-run. Nothing is written while any row is in error.');
  } else if (!committed) {
    lines.push('');
    lines.push('No errors. Re-run with --commit to write these rows.');
  }

  return lines.join('\n');
}
