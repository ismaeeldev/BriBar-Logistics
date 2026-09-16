'use client';

import type { FormState } from '@/app/(app)/admin/actions';
import { EntityForm } from '@/components/admin/entity-form';
import { DateInput, Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/field';
import { FIELD_LABELS, UI, VAT_RATE_LABELS } from '@/lib/i18n/messages';

export interface ReceivedInvoiceFormContext {
  suppliers: { id: string; name: string }[];
  categories: { id: string; name: string; defaultVatRate: string }[];
  vehicles: { id: string; registrationPlate: string; referenceName: string | null }[];
  states: { id: string; name: string }[];
  paymentMethods: { id: string; name: string }[];
}

const VAT_RATES = ['STANDARD', 'REDUCED', 'SUPER_REDUCED', 'ZERO', 'EXEMPT'] as const;

/** Create/edit a received invoice (ERP roadmap Phase 3). Admin-only. */
export function ReceivedInvoiceForm({
  action,
  submitLabel,
  context,
  initial,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  context: ReceivedInvoiceFormContext;
  initial?: {
    supplierId: string;
    categoryId: string;
    concept: string;
    vehicleId: string;
    invoiceDate: string;
    base: string;
    vatRate: string;
    stateId: string;
    paymentMethodId: string;
    notes: string;
  };
}) {
  return (
    <EntityForm action={action} submitLabel={submitLabel}>
      {({ fieldErrors, values }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={FIELD_LABELS.supplier}
              required
              errors={fieldErrors?.['supplierId']}
              hint={UI.admin.receivedInvoices.supplierHint}
            >
              {(props) => (
                <Select
                  {...props}
                  name="supplierId"
                  required
                  defaultValue={values?.['supplierId'] ?? initial?.supplierId ?? ''}
                >
                  <option value="" disabled>
                    {UI.admin.receivedInvoices.chooseSupplier}
                  </option>
                  {context.suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              label={FIELD_LABELS.category}
              required
              errors={fieldErrors?.['categoryId']}
              hint={UI.admin.receivedInvoices.categoryHint}
            >
              {(props) => (
                <Select
                  {...props}
                  name="categoryId"
                  required
                  defaultValue={values?.['categoryId'] ?? initial?.categoryId ?? ''}
                >
                  <option value="" disabled>
                    {UI.admin.receivedInvoices.chooseCategory}
                  </option>
                  {context.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <Field label={FIELD_LABELS.concept} required errors={fieldErrors?.['concept']}>
            {(props) => (
              <Input
                {...props}
                name="concept"
                required
                autoComplete="off"
                defaultValue={values?.['concept'] ?? initial?.concept ?? ''}
              />
            )}
          </Field>

          <Field
            label={FIELD_LABELS.vehicle}
            optional
            errors={fieldErrors?.['vehicleId']}
            hint={UI.admin.receivedInvoices.vehicleHint}
          >
            {(props) => (
              <Select
                {...props}
                name="vehicleId"
                defaultValue={values?.['vehicleId'] ?? initial?.vehicleId ?? ''}
              >
                <option value="">{UI.admin.receivedInvoices.chooseVehicleOptional}</option>
                {context.vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registrationPlate}
                    {vehicle.referenceName ? ` — ${vehicle.referenceName}` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={FIELD_LABELS.invoiceDate} required errors={fieldErrors?.['invoiceDate']}>
              {(props) => (
                <DateInput
                  {...props}
                  name="invoiceDate"
                  required
                  defaultValue={values?.['invoiceDate'] ?? initial?.invoiceDate ?? ''}
                />
              )}
            </Field>

            <Field label={FIELD_LABELS.baseAmount} required errors={fieldErrors?.['base']}>
              {(props) => (
                <MoneyInput
                  {...props}
                  name="base"
                  required
                  placeholder="0,00"
                  defaultValue={values?.['base'] ?? initial?.base ?? ''}
                />
              )}
            </Field>
          </div>

          <Field label={FIELD_LABELS.vatRate} required errors={fieldErrors?.['vatRate']}>
            {(props) => (
              <Select
                {...props}
                name="vatRate"
                required
                defaultValue={values?.['vatRate'] ?? initial?.vatRate ?? 'STANDARD'}
              >
                {VAT_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {VAT_RATE_LABELS[rate]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={FIELD_LABELS.invoiceState} optional errors={fieldErrors?.['stateId']}>
              {(props) => (
                <Select
                  {...props}
                  name="stateId"
                  defaultValue={values?.['stateId'] ?? initial?.stateId ?? ''}
                >
                  <option value="">{UI.admin.receivedInvoices.chooseState}</option>
                  {context.states.map((state) => (
                    <option key={state.id} value={state.id}>
                      {state.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              label={FIELD_LABELS.paymentMethod}
              optional
              errors={fieldErrors?.['paymentMethodId']}
            >
              {(props) => (
                <Select
                  {...props}
                  name="paymentMethodId"
                  defaultValue={values?.['paymentMethodId'] ?? initial?.paymentMethodId ?? ''}
                >
                  <option value="">{UI.admin.receivedInvoices.choosePaymentMethod}</option>
                  {context.paymentMethods.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <Field label={FIELD_LABELS.observations} optional errors={fieldErrors?.['notes']}>
            {(props) => (
              <Textarea
                {...props}
                name="notes"
                defaultValue={values?.['notes'] ?? initial?.notes ?? ''}
              />
            )}
          </Field>
        </>
      )}
    </EntityForm>
  );
}
