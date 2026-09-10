/** Record a received invoice (ERP roadmap Phase 3, `/admin/received-invoices/new`). */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { createReceivedInvoiceAction } from '@/app/(app)/admin/actions';
import { ReceivedInvoiceForm } from '@/components/admin/received-invoice-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { UI } from '@/lib/i18n/messages';
import { expenseCategoryService } from '@/modules/expense-categories/service/expense-category.service';
import { lookupService } from '@/modules/lookup/service/lookup.service';
import { supplierService } from '@/modules/suppliers/service/supplier.service';
import { vehicleRepository } from '@/modules/vehicles/repository/vehicle.repository';

export const metadata = { title: UI.admin.receivedInvoices.newInvoice };

export default async function NewReceivedInvoicePage() {
  const actor = await requireAdmin();

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

      <PageHeader title={UI.admin.receivedInvoices.newInvoice} section={UI.nav.sectionFinance} />

      <ReceivedInvoiceForm
        action={createReceivedInvoiceAction}
        submitLabel={UI.common.create}
        context={{ suppliers, categories, vehicles, states, paymentMethods }}
      />
    </div>
  );
}
