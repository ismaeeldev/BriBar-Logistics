'use client';

import type { FormState } from '@/app/(app)/admin/actions';
import { ActiveToggle, EntityForm } from '@/components/admin/entity-form';
import { Field, Input } from '@/components/ui/field';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';

/** Create/edit a client (ERP roadmap Phase 1). */
export function ClientForm({
  action,
  submitLabel,
  initial,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  initial?: { name: string; taxId: string | null; isActive: boolean };
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
            label={FIELD_LABELS.taxId}
            optional
            errors={fieldErrors?.['taxId']}
            hint={UI.admin.clientTaxIdHint}
          >
            {(props) => (
              <Input
                {...props}
                name="taxId"
                autoComplete="off"
                defaultValue={values?.['taxId'] ?? initial?.taxId ?? ''}
              />
            )}
          </Field>

          <ActiveToggle
            defaultChecked={values ? values['isActive'] === 'on' : (initial?.isActive ?? true)}
            hint={UI.admin.clientActiveHint}
          />
        </>
      )}
    </EntityForm>
  );
}
