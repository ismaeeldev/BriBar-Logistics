'use client';

import type { FormState } from '@/app/(app)/admin/actions';
import { ActiveToggle, EntityForm } from '@/components/admin/entity-form';
import { Field, Input } from '@/components/ui/field';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';

/**
 * Create/edit one entry in a simple lookup list (ERP roadmap Phase 1). One
 * component for every kind — fuel types, payment methods, supplement types,
 * end clients — since the shape (a name, and active/inactive) never varies
 * by kind. See `lookup.schema.ts` for why `kind` itself is never a field.
 */
export function LookupForm({
  action,
  submitLabel,
  initial,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  initial?: { name: string; isActive: boolean };
}) {
  return (
    <EntityForm action={action} submitLabel={submitLabel}>
      {({ fieldErrors, values }) => (
        <>
          <Field
            label={FIELD_LABELS.name}
            required
            errors={fieldErrors?.['name']}
            hint={UI.admin.lookup.nameHint}
          >
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

          <ActiveToggle
            defaultChecked={values ? values['isActive'] === 'on' : (initial?.isActive ?? true)}
            hint={UI.admin.lookup.activeHint}
          />
        </>
      )}
    </EntityForm>
  );
}
