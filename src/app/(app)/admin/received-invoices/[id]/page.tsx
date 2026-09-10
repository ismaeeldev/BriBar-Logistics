/**
 * Edit a received invoice (ERP roadmap Phase 3, `/admin/received-invoices/[id]`).
 *
 * Nothing references a `ReceivedInvoice` row, so - like `Refuelling` - it is
 * always deletable, with the fixed `{ canDelete: true }` `DeleteRecord`
 * expects.
 */
import { ArrowLeft, Calculator } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  deleteReceivedInvoiceAction,
  updateReceivedInvoiceAction,
} from '@/app/(app)/admin/actions';
import { DeleteRecord } from '@/components/admin/delete-record';
import { ReceivedInvoiceForm } from '@/components/admin/received-invoice-form';
import { Alert, Card, CardBody, CardHeader, CardTitle, DetailRow, PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { FIELD_LABELS, NUMBER_LOCALE, UI } from '@/lib/i18n/messages';
import { centsToInputValue, formatEuros } from '@/lib/money/money';
import { toIsoDate } from '@/lib/time/business-date';
import { expenseCategoryService } from '@/modules/expense-categories/service/expense-category.service';
import { lookupService } from '@/modules/lookup/service/lookup.service';
import { receivedInvoiceService } from '@/modules/received-invoices/service/received-invoice.service';
import { supplierService } from '@/modules/suppliers/service/supplier.service';
import { vehicleRepository } from '@/modules/vehicles/repository/vehicle.repository';

export const metadata = { title: UI.admin.receivedInvoices.editInvoice };

export default async function EditReceivedInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;
  const flags = await searchParams;

  let invoice;
  try {
    invoice = await receivedInvoiceService.getById(actor, id);
  } catch (error) {
    if (isAppError(error) && error.code === ErrorCode.NOT_FOUND) notFound();
    throw error;
  }

  const [suppliers, categories, vehicles, states, paymentMethods] = await Promise.all([
    supplierService.list(actor, { isActive: true }),
    expenseCategoryService.list({ isActive: true }),
    vehicleRepository.list({ isActive: true }),
    lookupService.list(actor, 'INVOICE_STATE', { isActive: true }),
    lookupService.list(actor, 'PAYMENT_METHOD', { isActive: true }),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/received-invoices"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.receivedInvoices.title}
      </Link>

      <PageHeader
        title={UI.admin.receivedInvoices.editInvoice}
        section={UI.nav.sectionFinance}
        description={`#${invoice.invoiceCode}`}
      />

      {flags.updated ? <Alert tone="success" title={UI.admin.receivedInvoices.updated} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <Calculator className="size-5 text-emerald-600" />
            {UI.admin.receivedInvoices.detailSectionTitle}
          </CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="space-y-1">
            <DetailRow
              label={FIELD_LABELS.baseAmount}
              value={formatEuros(invoice.baseCents, NUMBER_LOCALE)}
            />
            <DetailRow
              label={FIELD_LABELS.vatAmount}
              value={formatEuros(invoice.vatCents, NUMBER_LOCALE)}
            />
            <DetailRow
              label={FIELD_LABELS.total}
              value={formatEuros(invoice.totalCents, NUMBER_LOCALE)}
            />
          </dl>
        </CardBody>
      </Card>

      <ReceivedInvoiceForm
        action={updateReceivedInvoiceAction.bind(null, id)}
        submitLabel={UI.common.save}
        context={{ suppliers, categories, vehicles, states, paymentMethods }}
        initial={{
          supplierId: invoice.supplierId,
          categoryId: invoice.categoryId,
          vehicleId: invoice.vehicleId ?? '',
          invoiceDate: toIsoDate(invoice.invoiceDate),
          base: centsToInputValue(invoice.baseCents),
          vatRate: invoice.vatRate,
          stateId: invoice.stateId ?? '',
          paymentMethodId: invoice.paymentMethodId ?? '',
          notes: invoice.notes ?? '',
        }}
      />

      <DeleteRecord
        action={deleteReceivedInvoiceAction.bind(null, id)}
        name={`#${invoice.invoiceCode}`}
        deletability={{ canDelete: true, blockers: [], cascades: [] }}
      />
    </div>
  );
}
