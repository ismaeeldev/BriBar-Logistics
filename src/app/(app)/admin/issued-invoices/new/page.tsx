/**
 * Issue an invoice (ERP roadmap Phase 4, `/admin/issued-invoices/new`).
 *
 * Two steps, both on this one route: pick a client (query-string driven,
 * `IssuedInvoiceClientPicker` — same shape as the admin Add Service driver
 * picker), then select from that client's billable services.
 */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { createIssuedInvoiceAction } from '@/app/(app)/admin/actions';
import { IssuedInvoiceClientPicker } from '@/components/admin/issued-invoice-client-picker';
import { IssuedInvoiceForm } from '@/components/admin/issued-invoice-form';
import { Alert, PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { UI } from '@/lib/i18n/messages';
import { clientService } from '@/modules/clients/service/client.service';
import { issuedInvoiceService } from '@/modules/issued-invoices/service/issued-invoice.service';
import { lookupService } from '@/modules/lookup/service/lookup.service';

export const metadata = { title: UI.admin.issuedInvoices.newInvoice };

export default async function NewIssuedInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const actor = await requireAdmin();
  const { clientId } = await searchParams;

  const clients = await clientService.list(actor, { isActive: true });

  const [services, states] = clientId
    ? await Promise.all([
        issuedInvoiceService.billableServicesForClient(actor, clientId),
        lookupService.list(actor, 'INVOICE_STATE', { isActive: true }),
      ])
    : [null, null];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/issued-invoices"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.issuedInvoices.title}
      </Link>

      <PageHeader title={UI.admin.issuedInvoices.newInvoice} section={UI.nav.sectionFinance} />

      <IssuedInvoiceClientPicker clients={clients} selectedClientId={clientId} />

      {!clientId || !services || !states ? (
        <Alert tone="info" title={UI.admin.issuedInvoices.chooseClient} />
      ) : (
        <IssuedInvoiceForm
          action={createIssuedInvoiceAction}
          clientId={clientId}
          services={services}
          states={states}
        />
      )}
    </div>
  );
}
