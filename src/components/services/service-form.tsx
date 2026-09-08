'use client';

import { Loader2, Save } from 'lucide-react';
import { useMemo, useState, useActionState } from 'react';

import { Button } from '@/components/ui/button';
import {
  CheckboxField,
  Field,
  KmInput,
  ReadOnlyValue,
  Select,
  Textarea,
  TimeInput,
} from '@/components/ui/field';
import { Alert, Card, CardBody, CardHeader, CardTitle } from '@/components/ui/primitives';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';
import { formatBusinessDate } from '@/lib/time/business-date';
import { calculateMileage, validateMileage } from '@/modules/services/domain/mileage';
import type { ServiceContextDto } from '@/modules/services/service/service.presenter';

import type { ServiceFormState } from '@/app/(app)/services/actions';

/**
 * The Add Service / Edit Service form (SRS 9, 17.2).
 *
 * ## Why the calculation runs here as well as on the server
 *
 * SRS 9.5 requires calculated mileage to be shown "once sufficient mileage
 * fields are available", and SRS 10.2 permits a live preview while making the
 * server authoritative. This component imports the *same* `calculateMileage`
 * and `validateMileage` the service layer uses — not a reimplementation — so
 * the preview can never disagree with what is ultimately stored. If the rule
 * changes, both move together or neither does.
 *
 * The submitted values are recalculated server-side regardless, and the form
 * has no field for `actualKm` or `serviceKm` to send (SRS 22.4).
 *
 * ## Why a server action rather than fetch
 *
 * The credentials never touch client state, validation errors come back typed,
 * and the form still submits with JavaScript unavailable — a driver on a bad
 * signal in an industrial estate is exactly the case that matters here.
 */

const ORDERED_KM_FIELDS = [
  { name: 'startDashboardKm', label: FIELD_LABELS.startDashboardKm },
  { name: 'startBaseKm', label: FIELD_LABELS.startBaseKm },
  { name: 'endBaseKm', label: FIELD_LABELS.endBaseKm },
  { name: 'endDashboardKm', label: FIELD_LABELS.endDashboardKm },
] as const;

export interface ServiceFormValues {
  vehicleId: string;
  routeId: string;
  startDashboardKm: string;
  startBaseKm: string;
  endBaseKm: string;
  endDashboardKm: string;
  departureTime: string;
  arrivalTime: string;
  endsNextDay: boolean;
  sites: string;
  observations: string;
}

export function ServiceForm({
  context,
  action,
  initialValues,
  submitLabel,
  serviceCode,
  driverId,
}: {
  context: ServiceContextDto;
  action: (state: ServiceFormState, formData: FormData) => Promise<ServiceFormState>;
  initialValues?: Partial<ServiceFormValues>;
  submitLabel: string;
  /** Present when editing; the ID is server-issued and never editable. */
  serviceCode?: string;
  /**
   * Set only when an administrator is filing on a driver's behalf (client
   * decision #7). Submitted as a hidden field so `createServiceAction` parses
   * the request with `adminCreateServiceSchema`. A driver's form never sets it,
   * and `updateServiceSchema` has no `driverId` at all, so edits ignore it.
   */
  driverId?: string;
}) {
  const [state, formAction, isPending] = useActionState<ServiceFormState, FormData>(action, {
    status: 'idle',
  });

  const [routeId, setRouteId] = useState(
    initialValues?.routeId ?? context.defaultRouteId ?? context.routes[0]?.id ?? '',
  );

  const [km, setKm] = useState({
    startDashboardKm: initialValues?.startDashboardKm ?? '',
    startBaseKm: initialValues?.startBaseKm ?? '',
    endBaseKm: initialValues?.endBaseKm ?? '',
    endDashboardKm: initialValues?.endDashboardKm ?? '',
  });

  /**
   * Repopulates the controlled fields from what the server received.
   *
   * SRS 24.1 forbids losing valid input because another field failed. React
   * may remount this component when the action returns a new tree, which would
   * reset the state below — so the values come back from the server with the
   * errors and are adopted here rather than trusting the state to survive.
   *
   * This is React's documented "adjust state when a prop changes" pattern: a
   * comparison during render, no effect, no extra paint.
   */
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === 'error' && state.values) {
      const echoed = state.values;
      setKm({
        startDashboardKm: echoed['startDashboardKm'] ?? '',
        startBaseKm: echoed['startBaseKm'] ?? '',
        endBaseKm: echoed['endBaseKm'] ?? '',
        endDashboardKm: echoed['endDashboardKm'] ?? '',
      });
      if (echoed['routeId']) setRouteId(echoed['routeId']);
    }
  }

  /** Uncontrolled fields read their post-failure value from the same echo. */
  const echoed = state.status === 'error' ? state.values : undefined;

  // SRS 9.5: "Changing Route/Contract shall immediately refresh Origin and
  // Destination." Derived from the selection rather than held in its own state,
  // so the two cannot fall out of step.
  const selectedRoute = context.routes.find((route) => route.id === routeId);

  /**
   * The live preview.
   *
   * Only shown once all four readings parse *and* pass the same validation the
   * server applies — a preview computed from a half-filled or invalid set would
   * show a negative or nonsensical total while the driver is still typing.
   */
  const preview = useMemo(() => {
    const parsed = {
      startDashboardKm: Number(km.startDashboardKm),
      startBaseKm: Number(km.startBaseKm),
      endBaseKm: Number(km.endBaseKm),
      endDashboardKm: Number(km.endDashboardKm),
    };

    const allPresent = Object.values(km).every((value) => value.trim() !== '');
    if (!allPresent) return null;
    if (validateMileage(parsed).length > 0) return null;

    return calculateMileage(parsed);
  }, [km]);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    // Capped well short of the column it sits in. A form is read one field at
    // a time, so its useful width is set by the longest single field rather
    // than by the space available — a text input stretched across a monitor is
    // harder to fill in, not easier. The driver shell is already narrow; this
    // is what keeps the same form from spanning the admin panel.
    <form action={formAction} className="mx-auto w-full max-w-2xl space-y-4 pb-28 sm:pb-2">
      {/* SRS 22.4: server-owned everywhere else, but an administrator filing for
          a driver must name them. Hidden rather than a visible control — the
          owning driver is chosen on the page before the form is shown, and the
          name is already displayed read-only below. */}
      {driverId ? <input type="hidden" name="driverId" value={driverId} /> : null}

      {/* A form-level failure that belongs to no single field: a conflict, a
          route that stopped being assignable, an unexpected error. */}
      {state.status === 'error' && state.message ? (
        <Alert tone="error" title={state.message}>
          {fieldErrors?.['root']?.join(' ')}
        </Alert>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* 1. Automatic values (SRS 9.2, 17.2)                              */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{UI.service.detailsSection}</CardTitle>
          <p className="text-muted-foreground text-xs">{UI.service.detailsHint}</p>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyValue
            label={FIELD_LABELS.serviceCode}
            value={serviceCode ? `#${serviceCode}` : UI.service.idOnSave}
            mono={Boolean(serviceCode)}
          />
          <ReadOnlyValue
            label={FIELD_LABELS.serviceDate}
            value={formatBusinessDate(context.serviceDate)}
          />
          <ReadOnlyValue
            label={FIELD_LABELS.driver}
            value={context.driver.name}
            // SRS 9.5: the Driver field always reflects the authenticated user
            // and cannot be switched. It is not an input at all.
          />
        </CardBody>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* 2. Route and vehicle (SRS 9.2, 14.4)                             */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{UI.service.routeSection}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <Field label={FIELD_LABELS.route} required errors={fieldErrors?.['routeId']}>
            {(props) => (
              <Select
                {...props}
                name="routeId"
                value={routeId}
                onChange={(event) => setRouteId(event.target.value)}
              >
                {context.routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.code} — {route.name}
                    {route.isDefault
                      ? ` (${UI.admin.defaultColumn.toLowerCase().replace('.', '')})`
                      : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {/* SRS 14.4: populated from the route, and the driver cannot
              override them. Read-only rather than disabled inputs, so they are
              obviously information rather than something broken. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyValue label={FIELD_LABELS.origin} value={selectedRoute?.origin ?? '—'} />
            <ReadOnlyValue
              label={FIELD_LABELS.destination}
              value={selectedRoute?.destination ?? '—'}
            />
          </div>

          <Field
            label={FIELD_LABELS.vehicle}
            required
            errors={fieldErrors?.['vehicleId']}
            hint={UI.service.vehicleHint}
          >
            {(props) => (
              <Select
                {...props}
                name="vehicleId"
                defaultValue={
                  echoed?.['vehicleId'] ??
                  initialValues?.vehicleId ??
                  context.defaultVehicleId ??
                  context.vehicles[0]?.id ??
                  ''
                }
              >
                {context.vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registrationPlate}
                    {vehicle.referenceName ? ` — ${vehicle.referenceName}` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </CardBody>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* 3. Mileage (SRS 9.3, 10)                                         */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{UI.service.mileageSection}</CardTitle>
          <p className="text-muted-foreground text-xs">{UI.service.mileageHint}</p>
        </CardHeader>
        <CardBody className="space-y-4">
          {/* One field per row on a phone — a driver is thumb-typing four
              numbers in order. Two columns from `sm`, where the pairs fall out
              as start readings above end readings. */}
          <div className="grid gap-4 sm:grid-cols-2">
            {ORDERED_KM_FIELDS.map(({ name, label }) => (
              <Field key={name} label={label} required errors={fieldErrors?.[name]}>
                {(props) => (
                  <KmInput
                    {...props}
                    name={name}
                    value={km[name]}
                    onChange={(event) =>
                      setKm((current) => ({ ...current, [name]: event.target.value }))
                    }
                    placeholder="0"
                  />
                )}
              </Field>
            ))}
          </div>

          <MileagePreview preview={preview} />
        </CardBody>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* 4. Times (SRS 9.3, 31.3)                                         */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{UI.service.timesSection}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={FIELD_LABELS.departureTime}
              required
              errors={fieldErrors?.['departureTime']}
            >
              {(props) => (
                <TimeInput
                  {...props}
                  name="departureTime"
                  defaultValue={echoed?.['departureTime'] ?? initialValues?.departureTime ?? ''}
                />
              )}
            </Field>

            <Field
              label={FIELD_LABELS.arrivalTime}
              required
              errors={fieldErrors?.['arrivalTime']}
            >
              {(props) => (
                <TimeInput
                  {...props}
                  name="arrivalTime"
                  defaultValue={echoed?.['arrivalTime'] ?? initialValues?.arrivalTime ?? ''}
                />
              )}
            </Field>
          </div>

          {/* The flag that makes an overnight run recordable. It only relaxes
              the same-day ordering rule; it can never itself be invalid
              (client decision #3, change request 2026-09-09). */}
          <CheckboxField
            name="endsNextDay"
            label={FIELD_LABELS.endsNextDay}
            hint={UI.service.overnightHint}
            defaultChecked={
              echoed ? echoed['endsNextDay'] === 'true' : (initialValues?.endsNextDay ?? false)
            }
          />
        </CardBody>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* 5. Optional notes (SRS 9.4)                                      */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{UI.service.notesSection}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <Field label={FIELD_LABELS.sites} optional errors={fieldErrors?.['sites']}>
            {(props) => (
              <Textarea
                {...props}
                name="sites"
                rows={2}
                defaultValue={echoed?.['sites'] ?? initialValues?.sites ?? ''}
              />
            )}
          </Field>

          <Field
            label={FIELD_LABELS.observations}
            optional
            errors={fieldErrors?.['observations']}
          >
            {(props) => (
              <Textarea
                {...props}
                name="observations"
                rows={3}
                defaultValue={echoed?.['observations'] ?? initialValues?.observations ?? ''}
              />
            )}
          </Field>
        </CardBody>
      </Card>

      {/*
        On a phone the submit is pinned to the bottom of the screen: the form is
        longer than the viewport, and a driver should never have to scroll
        hunting for it. `pb-safe` keeps it clear of the iOS home indicator.

        From `sm` up the bar dissolves into an ordinary right-aligned footer.
        A strip fixed across a monitor reads as a mobile app on a desktop, and
        with the whole form in view the button no longer needs pinning.
      */}
      <div className="bg-card/95 pb-safe fixed inset-x-0 bottom-0 z-10 border-t px-4 pt-3 backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:pt-2 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-3xl justify-end">
          <Button
            type="submit"
            size="lg"
            block
            className="sm:w-auto sm:min-w-52"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 aria-hidden className="size-5 animate-spin" />
                {UI.common.saving}
              </>
            ) : (
              <>
                <Save aria-hidden className="size-5" />
                {submitLabel}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

/**
 * The calculated totals (SRS 9.5, 10.1).
 *
 * "Calculated values shall be clearly labeled as calculated and not directly
 * editable" — so they render as a panel, not as disabled inputs, and there is
 * no form field behind them to submit.
 */
function MileagePreview({
  preview,
}: {
  preview: { actualKm: number; serviceKm: number } | null;
}) {
  return (
    <div className="bg-muted grid grid-cols-2 gap-3 rounded-lg p-3">
      <div>
        <p className="text-muted-foreground text-xs">{FIELD_LABELS.actualKm}</p>
        <p className="font-mono text-2xl font-semibold tabular-nums">
          {preview ? preview.actualKm : '—'}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">{FIELD_LABELS.serviceKm}</p>
        <p className="font-mono text-2xl font-semibold tabular-nums">
          {preview ? preview.serviceKm : '—'}
        </p>
      </div>
      <p className="text-muted-foreground col-span-2 text-xs">{UI.service.calculatedHint}</p>
    </div>
  );
}
