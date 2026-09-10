/**
 * Investment summary (ERP roadmap Phase 3, `07_Inversiones`, `/admin/investments`).
 *
 * A live aggregate, not a stored table — see `receivedInvoiceService
 * .investmentSummary`'s doc comment and ADR 0014 for why, and for what this
 * page deliberately does not attempt (payback/recovery against accumulated
 * profit, which needs Phase 6's analytics layer).
 */
import { PiggyBank } from 'lucide-react';

import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { Td, Th } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { FIELD_LABELS, NUMBER_LOCALE, UI } from '@/lib/i18n/messages';
import { formatEuros } from '@/lib/money/money';
import { receivedInvoiceService } from '@/modules/received-invoices/service/received-invoice.service';

export const metadata = { title: UI.admin.investments.title };

export default async function AdminInvestmentsPage() {
  const actor = await requireAdmin();
  const rows = await receivedInvoiceService.investmentSummary(actor);

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
    </div>
  );
}
