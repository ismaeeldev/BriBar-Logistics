'use client';

import { useMemo, useState } from 'react';

import type { FormState } from '@/app/(app)/admin/actions';
import { EntityForm } from '@/components/admin/entity-form';
import { DateInput, Field, Select, Textarea } from '@/components/ui/field';
import { Card, CardBody, CardHeader, CardTitle, EmptyState } from '@/components/ui/primitives';
import { FIELD_LABELS, NUMBER_LOCALE, UI, VAT_RATE_LABELS } from '@/lib/i18n/messages';
import { formatEuros } from '@/lib/money/money';
import { formatBusinessDateValue } from '@/lib/time/business-date';
import { FileText } from 'lucide-react';

export interface BillableServiceRow {
  id: string;
  serviceCode: string;
  serviceDate: Date;
  baseCents: number | null;
  route: { code: string; name: string };
}

const VAT_RATES = ['STANDARD', 'REDUCED', 'SUPER_REDUCED', 'ZERO', 'EXEMPT'] as const;

/**
 * Issue an invoice: pick which of a client's billable services it covers,
 * a date and a VAT rate. The running total updates client-side from the
 * same `baseCents` the server will sum — a preview, not the source of
 * truth: `issuedInvoiceService.create` recomputes it from the database on
 * submit (SRS 22.4's discipline).
 */
export function IssuedInvoiceForm({
  action,
  clientId,
  services,
  states,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  clientId: string;
  services: BillableServiceRow[];
  states: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(services.map((s) => s.id)));

  const selectedTotal = useMemo(
    () =>
      services
        .filter((service) => selected.has(service.id))
        .reduce((sum, service) => sum + (service.baseCents ?? 0), 0),
    [services, selected],
  );

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) =>
      current.size === services.length ? new Set() : new Set(services.map((s) => s.id)),
    );
  }

  if (services.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title={UI.admin.issuedInvoices.noBillableServices}
        description={UI.admin.issuedInvoices.noBillableServicesHint}
      />
    );
  }

  return (
    <EntityForm action={action} submitLabel={UI.admin.issuedInvoices.newInvoice}>
      {({ fieldErrors, values }) => (
        <>
          <input type="hidden" name="clientId" value={clientId} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={FIELD_LABELS.invoiceDate} required errors={fieldErrors?.['invoiceDate']}>
              {(props) => (
                <DateInput {...props} name="invoiceDate" required defaultValue={values?.['invoiceDate'] ?? ''} />
              )}
            </Field>

            <Field label={FIELD_LABELS.vatRate} required errors={fieldErrors?.['vatRate']}>
              {(props) => (
                <Select
                  {...props}
                  name="vatRate"
                  required
                  defaultValue={values?.['vatRate'] ?? 'STANDARD'}
                >
                  {VAT_RATES.map((rate) => (
                    <option key={rate} value={rate}>
                      {VAT_RATE_LABELS[rate]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <Field label={FIELD_LABELS.invoiceState} optional errors={fieldErrors?.['stateId']}>
            {(props) => (
              <Select {...props} name="stateId" defaultValue={values?.['stateId'] ?? ''}>
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
              <Textarea {...props} name="notes" defaultValue={values?.['notes'] ?? ''} />
            )}
          </Field>

          <Card>
            <CardHeader>
              <CardTitle>{UI.admin.issuedInvoices.servicesSectionTitle}</CardTitle>
              <p className="text-muted-foreground text-xs">{UI.admin.issuedInvoices.servicesHint}</p>
            </CardHeader>
            <CardBody className="space-y-3">
              {fieldErrors?.['serviceIds'] ? (
                <p className="text-destructive text-sm">{fieldErrors['serviceIds'].join(' ')}</p>
              ) : null}

              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={selected.size === services.length}
                  onChange={toggleAll}
                />
                {UI.admin.issuedInvoices.selectAll}
              </label>

              <div className="divide-y divide-border/40 rounded-lg border">
                {services.map((service) => (
                  <label
                    key={service.id}
                    className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/30"
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        name="serviceIds"
                        value={service.id}
                        checked={selected.has(service.id)}
                        onChange={() => toggle(service.id)}
                        className="accent-primary size-4"
                      />
                      <span>
                        <span className="font-mono font-semibold">#{service.serviceCode}</span>
                        <span className="text-muted-foreground ml-2">
                          {formatBusinessDateValue(service.serviceDate)} · {service.route.code}
                        </span>
                      </span>
                    </span>
                    <span className="font-semibold">
                      {service.baseCents != null ? formatEuros(service.baseCents, NUMBER_LOCALE) : '—'}
                    </span>
                  </label>
                ))}
              </div>

              <p className="text-right text-sm">
                {UI.admin.issuedInvoices.selectedCount(selected.size)} ·{' '}
                <span className="font-semibold">{formatEuros(selectedTotal, NUMBER_LOCALE)}</span>
              </p>
            </CardBody>
          </Card>
        </>
      )}
    </EntityForm>
  );
}
