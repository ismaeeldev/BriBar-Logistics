'use client';

import type { FormState } from '@/app/(app)/admin/actions';
import { EntityForm } from '@/components/admin/entity-form';
import { Field, KmInput, LitersInput, MoneyInput, Select, Textarea } from '@/components/ui/field';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/primitives';
import { FIELD_LABELS, UI, VAT_RATE_LABELS } from '@/lib/i18n/messages';

export interface RefuellingFormContext {
  vehicles: { id: string; registrationPlate: string; referenceName: string | null }[];
  drivers: { id: string; name: string }[];
  fuelTypes: { id: string; name: string }[];
  gasStations: { id: string; name: string }[];
  paymentMethods: { id: string; name: string }[];
}

const VAT_RATES = ['STANDARD', 'REDUCED', 'SUPER_REDUCED', 'ZERO', 'EXEMPT'] as const;

/** Create/edit a refuelling (ERP roadmap Phase 2). Admin-only. */
export function RefuellingForm({
  action,
  submitLabel,
  context,
  initial,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  context: RefuellingFormContext;
  initial?: {
    vehicleId: string;
    driverId: string;
    odometerKm: string;
    liters: string;
    total: string;
    vatRate: string;
    fuelTypeId: string;
    gasStationId: string;
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
              label={FIELD_LABELS.vehicle}
              required
              errors={fieldErrors?.['vehicleId']}
              hint={UI.admin.refuelling.vehicleHint}
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
              label={FIELD_LABELS.driver}
              required
              errors={fieldErrors?.['driverId']}
              hint={UI.admin.refuelling.driverHint}
            >
              {(props) => (
                <Select
                  {...props}
                  name="driverId"
                  required
                  defaultValue={values?.['driverId'] ?? initial?.driverId ?? ''}
                >
                  <option value="" disabled>
                    {UI.admin.chooseDriver}
                  </option>
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
            <Field
              label={FIELD_LABELS.odometerKm}
              required
              errors={fieldErrors?.['odometerKm']}
              hint={UI.admin.refuelling.odometerHint}
            >
              {(props) => (
                <KmInput
                  {...props}
                  name="odometerKm"
                  required
                  defaultValue={values?.['odometerKm'] ?? initial?.odometerKm ?? ''}
                />
              )}
            </Field>

            <Field label={FIELD_LABELS.liters} required errors={fieldErrors?.['liters']}>
              {(props) => (
                <LitersInput
                  {...props}
                  name="liters"
                  required
                  defaultValue={values?.['liters'] ?? initial?.liters ?? ''}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={FIELD_LABELS.total} required errors={fieldErrors?.['total']}>
              {(props) => (
                <MoneyInput
                  {...props}
                  name="total"
                  required
                  placeholder="0,00"
                  defaultValue={values?.['total'] ?? initial?.total ?? ''}
                />
              )}
            </Field>

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
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{UI.admin.refuelling.categorisationSectionTitle}</CardTitle>
              <p className="text-muted-foreground text-xs">
                {UI.admin.refuelling.categorisationHint}
              </p>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  label={FIELD_LABELS.fuelType}
                  required
                  errors={fieldErrors?.['fuelTypeId']}
                >
                  {(props) => (
                    <Select
                      {...props}
                      name="fuelTypeId"
                      required
                      defaultValue={values?.['fuelTypeId'] ?? initial?.fuelTypeId ?? ''}
                    >
                      <option value="" disabled>
                        {UI.admin.refuelling.chooseFuelType}
                      </option>
                      {context.fuelTypes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>

                <Field
                  label={FIELD_LABELS.gasStation}
                  required
                  errors={fieldErrors?.['gasStationId']}
                >
                  {(props) => (
                    <Select
                      {...props}
                      name="gasStationId"
                      required
                      defaultValue={values?.['gasStationId'] ?? initial?.gasStationId ?? ''}
                    >
                      <option value="" disabled>
                        {UI.admin.refuelling.chooseGasStation}
                      </option>
                      {context.gasStations.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>

                <Field
                  label={FIELD_LABELS.paymentMethod}
                  required
                  errors={fieldErrors?.['paymentMethodId']}
                >
                  {(props) => (
                    <Select
                      {...props}
                      name="paymentMethodId"
                      required
                      defaultValue={values?.['paymentMethodId'] ?? initial?.paymentMethodId ?? ''}
                    >
                      <option value="" disabled>
                        {UI.admin.refuelling.choosePaymentMethod}
                      </option>
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
            </CardBody>
          </Card>
        </>
      )}
    </EntityForm>
  );
}
