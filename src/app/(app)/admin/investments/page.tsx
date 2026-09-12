/**
 * Investment summary (ERP roadmap Phase 3, `07_Inversiones`, `/admin/investments`).
 *
 * A live aggregate, not a stored table — see `receivedInvoiceService
 * .investmentSummary`'s doc comment and ADR 0014 for why.
 *
 * The recovery section below it (client decision 2026-09-13, moved off
 * `/admin/analytics`) is computed by `analyticsService.investmentRecovery`
 * instead — payback against accumulated profit needs revenue and every other
 * cost source aggregated, which only the analytics layer does (ADR 0014's own
 * deferral).
 */
import { PiggyBank } from 'lucide-react';

import { EmptyState, PageHeader, Card, CardBody, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Td, Th } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { FIELD_LABELS, NUMBER_LOCALE, UI } from '@/lib/i18n/messages';
import { formatEuros } from '@/lib/money/money';
import { receivedInvoiceService } from '@/modules/received-invoices/service/received-invoice.service';
import { analyticsService } from '@/modules/analytics/service/analytics.service';
import { cn } from '@/lib/utils/cn';

export const metadata = { title: UI.admin.investments.title };

function pct(ratio: number | null): string {
  return ratio === null ? '—' : `${(ratio * 100).toFixed(1)}%`;
}

export default async function AdminInvestmentsPage() {
  const actor = await requireAdmin();
  const [rows, recovery] = await Promise.all([
    receivedInvoiceService.investmentSummary(actor),
    analyticsService.investmentRecovery(actor),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title={UI.admin.investments.title} section={UI.nav.sectionFinance} />
      <p className="text-muted-foreground -mt-2 text-sm">{UI.admin.investments.hint}</p>

      {rows.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title={UI.admin.investments.noInvestments}
          description={UI.admin.investments.noInvestmentsHint}
        />
      ) : (
        <div className="bg-card overflow-x-auto rounded-xl border">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <Th>{UI.admin.investments.vehicleColumn}</Th>
                <Th>{UI.admin.investments.invoiceCountColumn}</Th>
                <Th>{UI.admin.investments.totalColumn}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.vehicle.id} className="border-b last:border-0">
                  <Td className="py-3">
                    <span className="text-[13px] font-semibold text-foreground uppercase">
                      {row.vehicle.registrationPlate}
                    </span>
                    {row.vehicle.referenceName ? (
                      <span className="text-muted-foreground ml-2 text-[12px]">
                        {row.vehicle.referenceName}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="py-3">
                    <span className="text-[13px] text-muted-foreground">{row.invoiceCount}</span>
                  </Td>
                  <Td className="py-3">
                    <span className="text-[13px] font-bold text-foreground">
                      {formatEuros(row.totalCents, NUMBER_LOCALE)}
                    </span>
                  </Td>
                </tr>
              ))}
              <tr>
                <Td className="pt-4 font-semibold text-foreground">{FIELD_LABELS.total}</Td>
                <Td className="pt-4">
                  <span className="text-[13px] text-muted-foreground">
                    {rows.reduce((sum, row) => sum + row.invoiceCount, 0)}
                  </span>
                </Td>
                <Td className="pt-4">
                  <span className="text-[13px] font-bold text-foreground">
                    {formatEuros(
                      rows.reduce((sum, row) => sum + row.totalCents, 0),
                      NUMBER_LOCALE,
                    )}
                  </span>
                </Td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* "Recuperación de la inversión" - moved here from Análisis (client
          decision 2026-09-13), next to the totals it is computed against. */}
      {recovery.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <PiggyBank className="size-5 text-emerald-600" />
              {UI.admin.investments.recoveryTitle}
            </CardTitle>
            <p className="text-muted-foreground text-xs">{UI.admin.investments.recoveryHint}</p>
          </CardHeader>
          <CardBody className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <Th>{UI.admin.investments.vehicleColumn}</Th>
                  <Th>{UI.admin.investments.investmentColumn}</Th>
                  <Th>{UI.admin.investments.profitColumn}</Th>
                  <Th>{UI.admin.investments.recoveryColumn}</Th>
                  <Th>{UI.admin.investments.outstandingColumn}</Th>
                </tr>
              </thead>
              <tbody>
                {recovery.map((row) => (
                  <tr key={row.vehicleId} className="border-b last:border-0">
                    <Td className="py-2.5 font-semibold uppercase">{row.plate}</Td>
                    <Td className="py-2.5">{formatEuros(row.investmentCents, NUMBER_LOCALE)}</Td>
                    <Td
                      className={cn(
                        'py-2.5',
                        row.cumulativeProfitCents >= 0 ? '' : 'text-destructive',
                      )}
                    >
                      {formatEuros(row.cumulativeProfitCents, NUMBER_LOCALE)}
                    </Td>
                    <Td className="py-2.5">
                      {row.recovered ? (
                        <span className="font-semibold text-emerald-600">
                          {UI.admin.investments.recovered}
                        </span>
                      ) : (
                        pct(row.recoveryRatio)
                      )}
                    </Td>
                    <Td className="py-2.5">{formatEuros(row.outstandingCents, NUMBER_LOCALE)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
