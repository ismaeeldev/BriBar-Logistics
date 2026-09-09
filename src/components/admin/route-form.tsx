'use client';

import type { FormState } from '@/app/(app)/admin/actions';
import { ActiveToggle, EntityForm } from '@/components/admin/entity-form';
import { Field, Input, MoneyInput } from '@/components/ui/field';
import { Alert } from '@/components/ui/primitives';
import { centsToInputValue } from '@/lib/money/money';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';

/** Create/edit a route/contract (SRS 14.1, 14.2). */
export function RouteForm({
  action,
  submitLabel,
  initial,
  assignedDriverCount,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  initial?: {
    code: string;
    name: string;
    origin: string;
    destination: string;
    isActive: boolean;
    /** EUR cents, or null if none set (ERP roadmap Phase 0). */
    defaultRateCents: number | null;
  };
  /** Only supplied when editing; drives the deactivation warning. */
  assignedDriverCount?: number;
}) {
  return (
    <EntityForm action={action} submitLabel={submitLabel}>
      {({ fieldErrors, values }) => (
        <>
          <Field
            label={FIELD_LABELS.routeCode}
            required
            errors={fieldErrors?.['code']}
            hint={UI.admin.routeCodeHint}
          >
            {(props) => (
              <Input
                {...props}
                name="code"
                required
                autoCapitalize="characters"
                autoComplete="off"
                className="font-mono"
                defaultValue={values?.['code'] ?? initial?.code ?? ''}
              />
            )}
          </Field>

          <Field label={FIELD_LABELS.routeName} required errors={fieldErrors?.['name']}>
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

          {/*
            SRS 14.2 permits changing these at any time, and SRS 21.4 requires
            that doing so leave existing services alone. Each service stores its
            own snapshot, so the note below is a statement of fact rather than a
            caveat.
          */}
          <Field label={FIELD_LABELS.origin} required errors={fieldErrors?.['origin']}>
            {(props) => (
              <Input
                {...props}
                name="origin"
                required
                autoComplete="off"
                defaultValue={values?.['origin'] ?? initial?.origin ?? ''}
              />
            )}
          </Field>

          <Field
            label={FIELD_LABELS.destination}
            required
            errors={fieldErrors?.['destination']}
          >
            {(props) => (
              <Input
                {...props}
                name="destination"
                required
                autoComplete="off"
                defaultValue={values?.['destination'] ?? initial?.destination ?? ''}
              />
            )}
          </Field>

          {initial ? <Alert tone="info">{UI.admin.routeSnapshotNote}</Alert> : null}

          {/* Admin-only (ERP roadmap Phase 0): a driver never sees a rate
              anywhere in the app. Snapshotted onto every new service filed on
              this route; editing it here does not touch existing services. */}
          <Field
            label={FIELD_LABELS.defaultRate}
            optional
            errors={fieldErrors?.['defaultRate']}
            hint={UI.admin.defaultRateHint}
          >
            {(props) => (
              <MoneyInput
                {...props}
                name="defaultRate"
                placeholder="0,00"
                defaultValue={
                  values?.['defaultRate'] ??
                  (initial?.defaultRateCents != null
                    ? centsToInputValue(initial.defaultRateCents)
                    : '')
                }
              />
            )}
          </Field>

          <ActiveToggle
            defaultChecked={values ? values['isActive'] === 'on' : (initial?.isActive ?? true)}
            hint={
              assignedDriverCount && assignedDriverCount > 0
                ? UI.admin.routeActiveHintWithDrivers(assignedDriverCount)
                : UI.admin.routeActiveHint
            }
          />
        </>
      )}
    </EntityForm>
  );
}
