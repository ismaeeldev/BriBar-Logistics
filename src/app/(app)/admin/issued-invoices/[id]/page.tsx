/**
 * View/edit an issued invoice (ERP roadmap Phase 4, `/admin/issued-invoices/[id]`).
 *
 * Only the state and notes are editable here — see the doc comment on
 * `issuedInvoiceService.update` for why the client, date, rate and service
 * list are fixed once issued. Nothing references an `IssuedInvoice` row
 * (deleting it un-bills its services rather than being blocked), so it is
 * always deletable, the same `{ canDelete: true }` shape `Refuelling` and
 * `ReceivedInvoice` use.
 */
import { ArrowLeft, FileOutput } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { deleteIssuedInvoiceAction, updateIssuedInvoiceAction } from '@/app/(app)/admin/actions';
import { DeleteRecord } from '@/components/admin/delete-record';
import { EntityForm } from '@/components/admin/entity-form';
import { Field, Select, Textarea } from '@/components/ui/field';
import {
  Alert,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DetailRow,
  PageHeader,
} from '@/components/ui/primitives';
import { Td, Th } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { FIELD_LABELS, NUMBER_LOCALE, UI } from '@/lib/i18n/messages';
import { formatEuros } from '@/lib/money/money';
import { formatBusinessDateValue } from '@/lib/time/business-date';
import { issuedInvoiceService } from '@/modules/issued-invoices/service/issued-invoice.service';
import { lookupService } from '@/modules/lookup/service/lookup.service';

export const metadata = { title: UI.admin.issuedInvoices.editInvoice };

export default async function IssuedInvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; updated?: string }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;
  const flags = await searchParams;

  let invoice;
  try {
    invoice = await issuedInvoiceService.getById(actor, id);
  } catch (error) {
    if (isAppError(error) && error.code === ErrorCode.NOT_FOUND) notFound();
    throw error;
  }

  const states = await lookupService.list(actor, 'INVOICE_STATE', { isActive: true });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/issued-invoices"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.issuedInvoices.title}
      </Link>

      <PageHeader
        title={UI.admin.issuedInvoices.editInvoice}
        section={UI.nav.sectionFinance}
        description={`#${invoice.invoiceCode} · ${invoice.client.name}`}
      />

      {flags.created ? <Alert tone="success" title={UI.admin.issuedInvoices.created} /> : null}
      {flags.updated ? <Alert tone="success" title={UI.admin.receivedInvoices.updated} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <FileOutput className="size-5 text-sky-600" />
            {UI.admin.issuedInvoices.detailSectionTitle}
          </CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="space-y-1">
            <DetailRow label={FIELD_LABELS.client} value={invoice.client.name} />
            <DetailRow
              label={FIELD_LABELS.invoiceDate}
              value={formatBusinessDateValue(invoice.invoiceDate)}
            />
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

      <Card>
        <CardHeader>
          <CardTitle>{UI.admin.issuedInvoices.linkedServicesTitle}</CardTitle>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <Th>{FIELD_LABELS.serviceCode}</Th>
                <Th>{FIELD_LABELS.serviceDate}</Th>
                <Th>{FIELD_LABELS.route}</Th>
                <Th>{FIELD_LABELS.baseAmount}</Th>
              </tr>
            </thead>
            <tbody>
              {invoice.services.map((service) => (
                <tr key={service.id} className="border-b last:border-0">
                  <Td className="py-2 font-mono font-semibold">#{service.serviceCode}</Td>
                  <Td className="py-2">{formatBusinessDateValue(service.serviceDate)}</Td>
                  <Td className="py-2">{service.route.code}</Td>
                  <Td className="py-2">
                    {service.baseCents != null
                      ? formatEuros(service.baseCents, NUMBER_LOCALE)
                      : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <EntityForm
        action={updateIssuedInvoiceAction.bind(null, id)}
        submitLabel={UI.common.save}
      >
        {({ fieldErrors, values }) => (
          <>
            <Field label={FIELD_LABELS.invoiceState} optional errors={fieldErrors?.['stateId']}>
              {(props) => (
                <Select
                  {...props}
                  name="stateId"
                  defaultValue={values?.['stateId'] ?? invoice.state?.id ?? ''}
                >
                  <option value="">{UI.admin.receivedInvoices.chooseState}</option>
                  {states.map((state) => (
                    <option key={state.id} value={state.id}>
                      {state.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label={FIELD_LABELS.observations} optional errors={fieldErrors?.['notes']}>
              {(props) => (
                <Textarea
                  {...props}
                  name="notes"
                  defaultValue={values?.['notes'] ?? invoice.notes ?? ''}
                />
              )}
            </Field>
          </>
        )}
      </EntityForm>

      <DeleteRecord
        action={deleteIssuedInvoiceAction.bind(null, id)}
        name={`#${invoice.invoiceCode}`}
        deletability={{ canDelete: true, blockers: [], cascades: [] }}
      />
    </div>
  );
}
