/**
 * Quarterly tax summary (ERP roadmap Phase 4, `06_Impuestos`, `/admin/taxes`).
 *
 * Read-only, derived from the two invoice modules' own VAT columns — see
 * `taxService.quarterlySummary`'s doc comment. No new table, same as
 * `/admin/investments`.
 */
import { Landmark } from 'lucide-react';

import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { Td, Th } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { NUMBER_LOCALE, UI } from '@/lib/i18n/messages';
import { formatEuros } from '@/lib/money/money';
import { taxService } from '@/modules/taxes/service/tax.service';
import { cn } from '@/lib/utils/cn';

export const metadata = { title: UI.admin.taxes.title };

export default async function AdminTaxesPage() {
  const actor = await requireAdmin();
  const rows = await taxService.quarterlySummary(actor);

  return (
    <div className="space-y-5">
      <PageHeader title={UI.admin.taxes.title} section={UI.nav.sectionFinance} />
      <p className="text-muted-foreground -mt-2 text-sm">{UI.admin.taxes.hint}</p>

      {rows.length === 0 ? (
        <EmptyState icon={Landmark} title={UI.admin.taxes.noData} description={UI.admin.taxes.noDataHint} />
      ) : (
        <div className="bg-card overflow-x-auto rounded-xl border">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <Th>{UI.admin.taxes.periodColumn}</Th>
                <Th>{UI.admin.taxes.vatOutputColumn}</Th>
                <Th>{UI.admin.taxes.vatInputColumn}</Th>
                <Th>{UI.admin.taxes.balanceColumn}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.year}-Q${row.quarter}`} className="border-b last:border-0">
                  <Td className="py-3 font-semibold text-foreground">
                    {row.year} · T{row.quarter}
                  </Td>
                  <Td className="py-3">
                    <span className="text-[13px] text-muted-foreground">
                      {formatEuros(row.vatOutputCents, NUMBER_LOCALE)}
                    </span>
                  </Td>
                  <Td className="py-3">
                    <span className="text-[13px] text-muted-foreground">
                      {formatEuros(row.vatInputCents, NUMBER_LOCALE)}
                    </span>
                  </Td>
                  <Td className="py-3">
                    <span
                      className={cn(
                        'text-[13px] font-bold',
                        row.balanceCents >= 0 ? 'text-destructive' : 'text-emerald-600',
                      )}
                    >
                      {formatEuros(Math.abs(row.balanceCents), NUMBER_LOCALE)}
                      <span className="text-muted-foreground ml-1.5 text-[11px] font-normal">
                        {row.balanceCents >= 0
                          ? UI.admin.taxes.balanceDue
                          : UI.admin.taxes.balanceRefund}
                      </span>
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
