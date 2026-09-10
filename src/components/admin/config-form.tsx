'use client';

import type { FormState } from '@/app/(app)/admin/actions';
import { EntityForm } from '@/components/admin/entity-form';
import { Field, KmInput, LitersInput, MoneyInput } from '@/components/ui/field';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';

/** The single operational-defaults form (`99_Config`, ERP roadmap Phase 1). */
export function ConfigForm({
  action,
  initial,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: { oilChangeIntervalKm: string; defaultConsumption: string; defaultFuelPrice: string };
}) {
  return (
    <EntityForm action={action} submitLabel={UI.common.save}>
      {({ fieldErrors, values }) => (
        <>
          <Field
            label={FIELD_LABELS.oilChangeIntervalKm}
            required
            errors={fieldErrors?.['oilChangeIntervalKm']}
            hint={UI.admin.config.oilChangeHint}
          >
            {(props) => (
              <KmInput
                {...props}
                name="oilChangeIntervalKm"
                required
                defaultValue={values?.['oilChangeIntervalKm'] ?? initial.oilChangeIntervalKm}
              />
            )}
          </Field>

          <Field
            label={FIELD_LABELS.defaultConsumptionMlPer100Km}
            required
            errors={fieldErrors?.['defaultConsumption']}
            hint={UI.admin.config.consumptionHint}
          >
            {(props) => (
              <LitersInput
                {...props}
                name="defaultConsumption"
                required
                defaultValue={values?.['defaultConsumption'] ?? initial.defaultConsumption}
              />
            )}
          </Field>

          <Field
            label={FIELD_LABELS.defaultFuelPriceCentsPerLiter}
            required
            errors={fieldErrors?.['defaultFuelPrice']}
            hint={UI.admin.config.fuelPriceHint}
          >
            {(props) => (
              <MoneyInput
                {...props}
                name="defaultFuelPrice"
                required
                defaultValue={values?.['defaultFuelPrice'] ?? initial.defaultFuelPrice}
              />
            )}
          </Field>
        </>
      )}
    </EntityForm>
  );
}
