'use client';

import type { FormState } from '@/app/(app)/admin/actions';
import { EntityForm } from '@/components/admin/entity-form';
import { DateInput, Field, KmInput, Select, Textarea } from '@/components/ui/field';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';

export interface MaintenanceRecordFormContext {
  vehicles: { id: string; registrationPlate: string; referenceName: string | null }[];
  maintenanceTypes: { id: string; name: string }[];
}

/** Create/edit a maintenance record (ERP roadmap Phase 5, `05Mantenimiento`). Admin-only. */
export function MaintenanceRecordForm({
  action,
  submitLabel,
  context,
  initial,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  context: MaintenanceRecordFormContext;
  initial?: {
    vehicleId: string;
    maintenanceTypeId: string;
    performedDate: string;
    performedKm: string;
    nextDueKm: string;
    nextDueDate: string;
    notes: string;
  };
}) {
  return (
    <EntityForm action={action} submitLabel={submitLabel}>
      {({ fieldErrors, values }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={FIELD_LABELS.vehicle}
              required
              errors={fieldErrors?.['vehicleId']}
              hint={UI.admin.maintenance.vehicleHint}
            >
              {(props) => (
                <Select
                  {...props}
                  name="vehicleId"
                  required
                  defaultValue={values?.['vehicleId'] ?? initial?.vehicleId ?? ''}
                >
                  <option value="" disabled>
                    {UI.admin.chooseVehicle}
                  </option>
                  {context.vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.registrationPlate}
                      {vehicle.referenceName ? ` — ${vehicle.referenceName}` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              label={FIELD_LABELS.maintenanceType}
              required
              errors={fieldErrors?.['maintenanceTypeId']}
              hint={UI.admin.maintenance.typeHint}
            >
              {(props) => (
                <Select
                  {...props}
                  name="maintenanceTypeId"
                  required
                  defaultValue={values?.['maintenanceTypeId'] ?? initial?.maintenanceTypeId ?? ''}
                >
                  <option value="" disabled>
                    {UI.admin.maintenance.chooseType}
                  </option>
                  {context.maintenanceTypes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={FIELD_LABELS.performedDate}
              required
              errors={fieldErrors?.['performedDate']}
            >
              {(props) => (
                <DateInput
                  {...props}
                  name="performedDate"
                  required
                  defaultValue={values?.['performedDate'] ?? initial?.performedDate ?? ''}
                />
              )}
            </Field>

            <Field label={FIELD_LABELS.performedKm} optional errors={fieldErrors?.['performedKm']}>
              {(props) => (
                <KmInput
                  {...props}
                  name="performedKm"
                  defaultValue={values?.['performedKm'] ?? initial?.performedKm ?? ''}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={FIELD_LABELS.nextDueKm}
              optional
              errors={fieldErrors?.['nextDueKm']}
              hint={UI.admin.maintenance.nextDueHint}
            >
              {(props) => (
                <KmInput
                  {...props}
                  name="nextDueKm"
                  defaultValue={values?.['nextDueKm'] ?? initial?.nextDueKm ?? ''}
                />
              )}
            </Field>

            <Field label={FIELD_LABELS.nextDueDate} optional errors={fieldErrors?.['nextDueDate']}>
              {(props) => (
                <DateInput
                  {...props}
                  name="nextDueDate"
                  defaultValue={values?.['nextDueDate'] ?? initial?.nextDueDate ?? ''}
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
