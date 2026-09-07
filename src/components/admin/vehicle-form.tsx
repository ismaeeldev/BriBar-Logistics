'use client';

import type { FormState } from '@/app/(app)/admin/actions';
import { ActiveToggle, EntityForm } from '@/components/admin/entity-form';
import { Field, Input } from '@/components/ui/field';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';

/** Create/edit a vehicle (SRS 13.1, 13.3). */
export function VehicleForm({
  action,
  submitLabel,
  initial,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  initial?: { registrationPlate: string; referenceName: string | null; isActive: boolean };
}) {
  return (
    <EntityForm action={action} submitLabel={submitLabel}>
      {({ fieldErrors, values }) => (
        <>
          <Field
            label={FIELD_LABELS.registrationPlate}
            required
            errors={fieldErrors?.['registrationPlate']}
          >
            {(props) => (
              <Input
                {...props}
                name="registrationPlate"
                required
                autoCapitalize="characters"
                autoComplete="off"
                className="font-mono"
                defaultValue={values?.['registrationPlate'] ?? initial?.registrationPlate ?? ''}
              />
            )}
          </Field>

          <Field
            label={FIELD_LABELS.referenceName}
            optional
            errors={fieldErrors?.['referenceName']}
            hint={UI.admin.vehicleNameHint}
          >
            {(props) => (
              <Input
                {...props}
                name="referenceName"
                autoComplete="off"
                defaultValue={values?.['referenceName'] ?? initial?.referenceName ?? ''}
              />
            )}
          </Field>

          <ActiveToggle
            defaultChecked={values ? values['isActive'] === 'on' : (initial?.isActive ?? true)}
            hint={UI.admin.vehicleActiveHint}
          />
        </>
      )}
    </EntityForm>
  );
}
