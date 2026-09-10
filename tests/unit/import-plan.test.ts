/**
 * The import plan summary and report (ERP roadmap Phase 7).
 */
import { describe, expect, it } from 'vitest';

import { collectErrors, summarize, type ImportPlan } from '@/modules/migration/domain/import-plan';
import { formatReport } from '@/modules/migration/domain/import-report';

const plan: ImportPlan = {
  entities: [
    {
      entity: 'client',
      sheet: 'tblClientes',
      rows: [
        { sheet: 'tblClientes', rowNumber: 1, naturalKey: 'acme', outcome: 'create', errors: [] },
        { sheet: 'tblClientes', rowNumber: 2, naturalKey: 'globex', outcome: 'skip', errors: [] },
      ],
    },
    {
      entity: 'receivedInvoice',
      sheet: 'tblFacturasRecibidas',
      rows: [
        {
          sheet: 'tblFacturasRecibidas',
          rowNumber: 1,
          naturalKey: 'FR000001',
          outcome: 'error',
          errors: ['supplier "Unknown SL" is not in its master-data sheet'],
        },
      ],
    },
  ],
};

describe('summarize', () => {
  it('counts each outcome per entity and overall', () => {
    const summary = summarize(plan);

    expect(summary.entities).toEqual([
      { entity: 'client', create: 1, skip: 1, error: 0 },
      { entity: 'receivedInvoice', create: 0, skip: 0, error: 1 },
    ]);
    expect(summary.totals).toEqual({ create: 1, skip: 1, error: 1 });
    expect(summary.ok).toBe(false);
  });

  it('is ok when nothing is in error', () => {
    expect(summarize({ entities: [] }).ok).toBe(true);
  });
});

describe('collectErrors', () => {
  it('prefixes each error with its sheet and row', () => {
    expect(collectErrors(plan)).toEqual([
      'tblFacturasRecibidas:1 — supplier "Unknown SL" is not in its master-data sheet',
    ]);
  });
});

describe('formatReport', () => {
  it('shows the dry-run banner and the error detail', () => {
    const report = formatReport(plan, { committed: false });

    expect(report).toContain('DRY RUN (nothing written)');
    expect(report).toContain('client');
    expect(report).toContain('1 row(s) could not be planned');
    expect(report).toContain('Nothing is written while any row is in error.');
  });

  it('invites a commit when there are no errors', () => {
    const clean: ImportPlan = { entities: [plan.entities[0]!] };
    const report = formatReport(clean, { committed: false });

    expect(report).toContain('No errors. Re-run with --commit');
  });

  it('shows the committed banner after a write', () => {
    expect(formatReport({ entities: [] }, { committed: true })).toContain('COMMITTED');
  });
});
