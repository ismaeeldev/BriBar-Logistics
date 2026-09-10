/**
 * Received invoice list (ERP roadmap Phase 3, `/admin/received-invoices`).
 *
 * Admin-only — mirrors `/admin/refuellings`'s structure.
 */
import { ChevronRight, FileText, Plus } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { Alert, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { ResponsiveList } from '@/components/ui/responsive-list';
import { Td, Th } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { FIELD_LABELS, NUMBER_LOCALE, UI } from '@/lib/i18n/messages';
import { formatEuros } from '@/lib/money/money';
import { formatBusinessDateValue } from '@/lib/time/business-date';
import { receivedInvoiceService } from '@/modules/received-invoices/service/received-invoice.service';
import { paginationSchema } from '@/modules/shared/schemas/common';
import { cn } from '@/lib/utils/cn';

export const metadata = { title: UI.admin.receivedInvoices.title };

export default async function AdminReceivedInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  const params = await searchParams;
  const pagination = paginationSchema.parse(params);
  const { items: invoices, total } = await receivedInvoiceService.listPage(actor, {}, pagination);

  return (
    <div className="space-y-5">
      <PageHeader
        title={UI.admin.receivedInvoices.title}
        section={UI.nav.sectionFinance}
        description={UI.common.total(total)}
        action={
          <Link
            href="/admin/received-invoices/new"
            className={cn(buttonVariants({ size: 'default' }))}
          >
            <Plus aria-hidden className="size-4" />
            {UI.common.new}
          </Link>
        }
      />

      {params['created'] ? (
        <Alert tone="success" title={UI.admin.receivedInvoices.created} />
      ) : null}
      {params['deleted'] ? (
        <Alert tone="success" title={UI.admin.receivedInvoices.deleted} />
      ) : null}

      <div className="pt-2">
        <ResponsiveList
          items={invoices}
          getKey={(invoice) => invoice.id}
          empty={
            <EmptyState
              icon={FileText}
              title={UI.admin.receivedInvoices.noInvoices}
              description={UI.admin.receivedInvoices.noInvoicesHint}
            />
          }
          head={
            <tr>
              <Th>{FIELD_LABELS.invoiceCode}</Th>
              <Th>{FIELD_LABELS.supplier}</Th>
              <Th className="hidden lg:table-cell">{FIELD_LABELS.category}</Th>
              <Th>{FIELD_LABELS.invoiceDate}</Th>
              <Th>{FIELD_LABELS.total}</Th>
              <Th />
            </tr>
          }
          row={(invoice) => (
            <>
              <Td className="align-middle py-3 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div className="bg-rose-600/10 text-rose-500 flex size-9 shrink-0 items-center justify-center rounded-xl">
                    <FileText className="size-4.5" />
                  </div>
                  <span className="text-[13px] font-bold font-mono text-foreground">
                    #{invoice.invoiceCode}
                  </span>
                </div>
              </Td>
              <Td className="align-middle py-3 whitespace-nowrap">
                <span className="text-[13px] font-semibold text-foreground">
                  {invoice.supplier.name}
                </span>
              </Td>
              <Td className="hidden align-middle py-3 lg:table-cell whitespace-nowrap">
                <span className="text-[13px] text-muted-foreground">{invoice.category.name}</span>
              </Td>
              <Td className="align-middle py-3 whitespace-nowrap">
                <span className="text-[13px] text-muted-foreground">
                  {formatBusinessDateValue(invoice.invoiceDate)}
                </span>
              </Td>
              <Td className="align-middle py-3 whitespace-nowrap">
                <span className="text-[13px] font-semibold text-foreground">
                  {formatEuros(invoice.totalCents, NUMBER_LOCALE)}
                </span>
              </Td>
              <Td className="align-middle py-3">
                <div className="flex justify-end">
                  <Link
                    href={`/admin/received-invoices/${invoice.id}`}
                    aria-label={UI.common.edit}
                    title={UI.common.edit}
                    className="text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-full transition-all hover:bg-muted"
                  >
                    <ChevronRight aria-hidden className="size-4" />
                  </Link>
                </div>
              </Td>
            </>
          )}
          card={(invoice) => (
            <Link
              href={`/admin/received-invoices/${invoice.id}`}
              className="group relative block p-4 transition-all hover:bg-muted/30 active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-baseline gap-2 min-w-0">
                    <span className="text-foreground font-mono font-semibold text-sm truncate">
                      #{invoice.invoiceCode}
                    </span>
                    <span className="text-muted-foreground text-xs truncate">
                      {invoice.supplier.name}
                    </span>
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="size-3.5 shrink-0" />
                    <span className="truncate text-xs text-foreground/80">
                      {formatBusinessDateValue(invoice.invoiceDate)} · {invoice.category.name}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    {formatEuros(invoice.totalCents, NUMBER_LOCALE)}
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="text-muted-foreground size-4 group-hover:text-foreground transition-colors"
                  />
                </div>
              </div>
            </Link>
          )}
        />
      </div>

      <Pagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={total}
        basePath="/admin/received-invoices"
        params={params}
      />
    </div>
  );
}
