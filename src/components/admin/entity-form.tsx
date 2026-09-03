'use client';

import { Loader2, Save } from 'lucide-react';
import type { ReactNode } from 'react';
import { useActionState } from 'react';

import type { FormState } from '@/app/(app)/admin/actions';
import { Button } from '@/components/ui/button';
import { Alert, Card, CardBody } from '@/components/ui/primitives';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';

/**
 * The shell every master-data form sits in.
 *
 * Owns the parts that are identical across vehicles, routes and users — the
 * action state, the form-level error, the pending submit button — so each
 * entity form is only its own fields. The render prop hands back the field
 * errors, which is the one thing those fields need from the action's result.
 */
export function EntityForm({
  action,
  submitLabel,
  children,
  footer,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  children: (helpers: {
    fieldErrors: Record<string, string[]> | undefined;
    values: Record<string, string> | undefined;
  }) => ReactNode;
  footer?: ReactNode;
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(action, {
    status: 'idle',
  });

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;
  const values = state.status === 'error' ? state.values : undefined;

  return (
    // Same cap as the service form, and for the same reason: three fields and
    // a toggle stretched across a 1000px column look like a settings page for
    // something much larger than a vehicle.
    <form action={formAction} className="max-w-2xl space-y-4">
      {state.status === 'error' && state.message ? (
        <Alert tone="error" title={state.message}>
          {fieldErrors?.['root']?.join(' ')}
        </Alert>
      ) : null}

      <Card>
        <CardBody className="space-y-4">{children({ fieldErrors, values })}</CardBody>
      </Card>

      {footer}

      <div className="flex justify-end">
        <Button type="submit" block className="sm:w-auto sm:min-w-40" disabled={isPending}>
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
    </form>
  );
}

/**
 * The active/inactive switch shared by every master-data form.
 *
 * SRS 21.5: deactivation is the removal path — there is no delete anywhere in
 * this application. The hint says what deactivating actually does, because
 * "inactive" alone does not tell an administrator that historical records are
 * preserved and only future selection is affected.
 */
export function ActiveToggle({
  defaultChecked,
  hint,
}: {
  defaultChecked: boolean;
  hint: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <input
          id="isActive"
          name="isActive"
          type="checkbox"
          defaultChecked={defaultChecked}
          className="border-input accent-primary mt-0.5 size-5 shrink-0 rounded"
        />
        <label htmlFor="isActive" className="flex-1 cursor-pointer text-sm font-medium">
          {FIELD_LABELS.isActive}
          <span className="text-muted-foreground mt-0.5 block text-xs font-normal">{hint}</span>
        </label>
      </div>
    </div>
  );
}
