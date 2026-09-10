'use client';

import type { FormState } from '@/app/(app)/admin/actions';
import { EntityForm } from '@/components/admin/entity-form';
import { DateInput, Field, Input, KmInput, Select, Textarea } from '@/components/ui/field';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';

export interface DailyKmLogFormContext {
  vehicles: { id: string; registrationPlate: string; referenceName: string | null }[];
  routes: { id: string; code: string; name: string }[];
  drivers: { id: string; name: string }[];
}

/** Create/edit a daily km log (ERP roadmap Phase 5, `00KmDiariosReales`). Admin-only. */
export function DailyKmLogForm({
  action,
  submitLabel,
  context,
  initial,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  context: DailyKmLogFormContext;
  initial?: {
    vehicleId: string;
    routeId: string;
    driverId: string;
    date: string;
    actualKm: string;
    workedHours: string;
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
              hint={UI.admin.dailyKm.vehicleHint}
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

            <Field label={FIELD_LABELS.date} required errors={fieldErrors?.['date']}>
              {(props) => (
                <DateInput
                  {...props}
                  name="date"
                  required
                  defaultValue={values?.['date'] ?? initial?.date ?? ''}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={FIELD_LABELS.route} optional errors={fieldErrors?.['routeId']}>
              {(props) => (
                <Select
                  {...props}
                  name="routeId"
                  defaultValue={values?.['routeId'] ?? initial?.routeId ?? ''}
                >
                  <option value="">{UI.admin.dailyKm.chooseRouteOptional}</option>
                  {context.routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.code} — {route.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label={FIELD_LABELS.driver} optional errors={fieldErrors?.['driverId']}>
              {(props) => (
                <Select
                  {...props}
                  name="driverId"
                  defaultValue={values?.['driverId'] ?? initial?.driverId ?? ''}
                >
                  <option value="">{UI.admin.dailyKm.chooseDriverOptional}</option>
                  {context.drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={FIELD_LABELS.actualKm} required errors={fieldErrors?.['actualKm']}>
              {(props) => (
                <KmInput
                  {...props}
                  name="actualKm"
                  required
                  defaultValue={values?.['actualKm'] ?? initial?.actualKm ?? ''}
                />
              )}
            </Field>

            <Field
              label={FIELD_LABELS.workedHours}
              optional
              errors={fieldErrors?.['workedHours']}
              hint={UI.admin.dailyKm.workedHoursHint}
            >
              {(props) => (
                <Input
                  {...props}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  name="workedHours"
                  defaultValue={values?.['workedHours'] ?? initial?.workedHours ?? ''}
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
