'use client';

import type { FormState } from '@/app/(app)/admin/actions';
import { ActiveToggle, EntityForm } from '@/components/admin/entity-form';
import { Field, Input, Select } from '@/components/ui/field';
import { EXPENSE_TYPE_LABELS, FIELD_LABELS, UI, VAT_RATE_LABELS } from '@/lib/i18n/messages';

const EXPENSE_TYPES = ['OPERATION', 'INVESTMENT', 'NON_OPERATING'] as const;
const VAT_RATES = ['STANDARD', 'REDUCED', 'SUPER_REDUCED', 'ZERO', 'EXEMPT'] as const;

/** Create/edit an expense category (ERP roadmap Phase 3). */
export function ExpenseCategoryForm({
  action,
  submitLabel,
  initial,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  initial?: {
    name: string;
    expenseType: string;
    defaultVatRate: string;
    isActive: boolean;
  };
}) {
  return (
    <EntityForm action={action} submitLabel={submitLabel}>
      {({ fieldErrors, values }) => (
        <>
          <Field label={FIELD_LABELS.name} required errors={fieldErrors?.['name']}>
            {(props) => (
              <Input
                {...props}
                name="name"
                required
                autoComplete="off"
                defaultValue={values?.['name'] ?? initial?.name ?? ''}
              />
            )}
          </Field>

          <Field
            label={FIELD_LABELS.expenseType}
            required
            errors={fieldErrors?.['expenseType']}
            hint={UI.admin.expenseCategories.expenseTypeHint}
          >
            {(props) => (
              <Select
                {...props}
                name="expenseType"
                required
                defaultValue={values?.['expenseType'] ?? initial?.expenseType ?? 'OPERATION'}
              >
                {EXPENSE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {EXPENSE_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label={FIELD_LABELS.vatRate}
            required
            errors={fieldErrors?.['defaultVatRate']}
            hint={UI.admin.expenseCategories.defaultVatRateHint}
          >
            {(props) => (
              <Select
                {...props}
                name="defaultVatRate"
                required
                defaultValue={values?.['defaultVatRate'] ?? initial?.defaultVatRate ?? 'STANDARD'}
              >
                {VAT_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {VAT_RATE_LABELS[rate]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <ActiveToggle
            defaultChecked={values ? values['isActive'] === 'on' : (initial?.isActive ?? true)}
            hint={UI.admin.expenseCategories.activeHint}
          />
        </>
      )}
    </EntityForm>
  );
}
