'use client';

import type { FormState } from '@/app/(app)/admin/actions';
import { EntityForm } from '@/components/admin/entity-form';
import { Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/field';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';

export interface PersonnelCostFormContext {
  users: { id: string; name: string }[];
}

/** Create/edit a personnel cost (ERP roadmap Phase 5, `04Personal`). Admin-only. */
export function PersonnelCostForm({
  action,
  submitLabel,
  context,
  initial,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  context: PersonnelCostFormContext;
  initial?: {
    userId: string;
    year: string;
    month: string;
    base: string;
    overtime: string;
    allowances: string;
    other: string;
    notes: string;
  };
}) {
  return (
    <EntityForm action={action} submitLabel={submitLabel}>
      {({ fieldErrors, values }) => (
        <>
          <Field
            label={FIELD_LABELS.employee}
            required
            errors={fieldErrors?.['userId']}
            hint={UI.admin.personnel.userHint}
          >
            {(props) => (
              <Select
                {...props}
                name="userId"
                required
                defaultValue={values?.['userId'] ?? initial?.userId ?? ''}
              >
                <option value="" disabled>
                  {UI.admin.chooseDriver}
                </option>
                {context.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={FIELD_LABELS.year} required errors={fieldErrors?.['year']}>
              {(props) => (
                <Input
                  {...props}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  name="year"
                  required
                  defaultValue={values?.['year'] ?? initial?.year ?? ''}
                />
              )}
            </Field>

            <Field label={FIELD_LABELS.month} required errors={fieldErrors?.['month']}>
              {(props) => (
                <Input
                  {...props}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  name="month"
                  required
                  defaultValue={values?.['month'] ?? initial?.month ?? ''}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={FIELD_LABELS.baseCost} required errors={fieldErrors?.['base']}>
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

            <Field label={FIELD_LABELS.overtime} optional errors={fieldErrors?.['overtime']}>
              {(props) => (
                <MoneyInput
                  {...props}
                  name="overtime"
                  placeholder="0,00"
                  defaultValue={values?.['overtime'] ?? initial?.overtime ?? ''}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={FIELD_LABELS.allowances} optional errors={fieldErrors?.['allowances']}>
              {(props) => (
                <MoneyInput
                  {...props}
                  name="allowances"
                  placeholder="0,00"
                  defaultValue={values?.['allowances'] ?? initial?.allowances ?? ''}
                />
              )}
            </Field>

            <Field label={FIELD_LABELS.otherAmount} optional errors={fieldErrors?.['other']}>
              {(props) => (
                <MoneyInput
                  {...props}
                  name="other"
                  placeholder="0,00"
                  defaultValue={values?.['other'] ?? initial?.other ?? ''}
                />
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
