'use client';

import type { FormState } from '@/app/(app)/admin/actions';
import { ActiveToggle, EntityForm } from '@/components/admin/entity-form';
import { Field, Input } from '@/components/ui/field';
import { Alert } from '@/components/ui/primitives';
import { FIELD_LABELS } from '@/lib/i18n/messages';

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
            hint="Se guarda en mayúsculas. Debe ser único."
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

          {initial ? (
            <Alert tone="info">
              Cambiar el origen o el destino solo afecta a los servicios que se registren a
              partir de ahora. Los servicios ya existentes conservan los valores con los que se
              crearon.
            </Alert>
          ) : null}

          <ActiveToggle
            defaultChecked={values ? values['isActive'] === 'on' : (initial?.isActive ?? true)}
            hint={
              assignedDriverCount && assignedDriverCount > 0
                ? `Al desactivarla dejará de estar disponible para ${assignedDriverCount} ${assignedDriverCount === 1 ? 'conductor' : 'conductores'}. Los servicios ya registrados no cambian.`
                : 'Una ruta inactiva no se ofrece para nuevos servicios, pero sigue asociada a los servicios ya registrados.'
            }
          />
        </>
      )}
    </EntityForm>
  );
}
