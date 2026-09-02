'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth/session';
import { isAppError } from '@/lib/errors/app-error';
import { toFieldErrors } from '@/lib/http/api-response';
import { ERRORS } from '@/lib/i18n/messages';
import { logger } from '@/lib/logger';
import { Role } from '@/modules/services/domain/service-status';
import {
  adminCreateServiceSchema,
  createServiceSchema,
  updateServiceSchema,
} from '@/modules/services/schemas/service.schema';
import { serviceService } from '@/modules/services/service/service.service';

/**
 * Server actions behind the service form.
 *
 * These and the API routes in `src/app/api` are two front doors onto the same
 * service layer, not two implementations. The action exists because a form
 * posting to a server action works without JavaScript and keeps typed errors;
 * the API exists because SRS 18 specifies it. Neither contains a business rule.
 */

export type ServiceFormState =
  | { status: 'idle' }
  | {
      status: 'error';
      /** Shown above the form when the failure belongs to no single field. */
      message?: string;
      fieldErrors?: Record<string, string[]>;
      /**
       * The values as submitted, echoed back so the form can repopulate.
       *
       * SRS 24.1: "The user should not lose valid entered data because another
       * field failed validation." Relying on the client keeping its own state
       * across the action's re-render is not good enough — React may remount
       * the component when the server sends a new tree, and a driver who has
       * just typed four odometer readings on a phone will not retype them.
       * Returning the values makes the guarantee independent of that.
       */
      values?: Record<string, string>;
    };

/**
 * Reads the form.
 *
 * `endsNextDay` needs care: an unchecked checkbox submits nothing at all, so
 * `formData.get` returns null and the value must become `false` rather than
 * `undefined` — otherwise the schema's default would apply and the distinction
 * would be invisible.
 */
/** The raw strings, for echoing back on failure. */
function toEchoValues(formData: FormData): Record<string, string> {
  const keys = [
    'vehicleId',
    'routeId',
    'startDashboardKm',
    'startBaseKm',
    'endBaseKm',
    'endDashboardKm',
    'departureTime',
    'arrivalTime',
    'sites',
    'observations',
  ] as const;

  const values: Record<string, string> = {};
  for (const key of keys) {
    const value = formData.get(key);
    if (typeof value === 'string') values[key] = value;
  }
  values['endsNextDay'] = formData.get('endsNextDay') !== null ? 'true' : '';
  return values;
}

function toPayload(formData: FormData): Record<string, unknown> {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };

  return {
    vehicleId: text('vehicleId'),
    routeId: text('routeId'),
    startDashboardKm: text('startDashboardKm'),
    startBaseKm: text('startBaseKm'),
    endBaseKm: text('endBaseKm'),
    endDashboardKm: text('endDashboardKm'),
    departureTime: text('departureTime'),
    arrivalTime: text('arrivalTime'),
    endsNextDay: formData.get('endsNextDay') !== null,
    sites: text('sites'),
    observations: text('observations'),
  };
}

/** Turns a thrown `AppError` into the shape the form renders. */
function toFormState(
  error: unknown,
  context: string,
  values: Record<string, string>,
): ServiceFormState {
  if (isAppError(error)) {
    return {
      status: 'error',
      message: error.message,
      values,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    };
  }

  // Never surfaced to the user (SRS 24.5); the detail goes to the log.
  logger.error(`Unhandled error in ${context}`, error);
  return { status: 'error', message: ERRORS.internal, values };
}

export async function createServiceAction(
  _state: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  let createdId: string;

  try {
    const actor = await requireUser();

    // The administrator variant is selected by role, exactly as the API route
    // does it — a driver's submission is never parsed with a schema that has a
    // `driverId` field (client decision #7, SRS 22.4).
    const isAdmin = actor.role === Role.ADMIN;
    const raw = isAdmin
      ? { ...toPayload(formData), driverId: formData.get('driverId') }
      : toPayload(formData);

    const parsed = isAdmin
      ? adminCreateServiceSchema.safeParse(raw)
      : createServiceSchema.safeParse(raw);

    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: toEchoValues(formData),
      };
    }

    const service = await serviceService.create(actor, parsed.data);
    createdId = service.id;
  } catch (error) {
    return toFormState(error, 'createServiceAction', toEchoValues(formData));
  }

  // Outside the try: `redirect` works by throwing, so catching it here would
  // report a successful submission as an error.
  revalidatePath('/driver');
  revalidatePath('/services');
  redirect(`/services/${createdId}?created=1`);
}

export async function updateServiceAction(
  serviceId: string,
  /**
   * Where to land after a successful save.
   *
   * A driver returns to their own detail page; an administrator to the review
   * page they came from. Bound by the caller rather than derived from the
   * actor's role, because the two routes render different pages and the one to
   * return to is a property of the screen, not of the user.
   */
  returnTo: 'driver' | 'admin',
  _state: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  try {
    const actor = await requireUser();

    const parsed = updateServiceSchema.safeParse(toPayload(formData));

    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: toEchoValues(formData),
      };
    }

    await serviceService.update(actor, serviceId, parsed.data);
  } catch (error) {
    // The SRS 24.4 conflict arrives here — an administrator approved the
    // service between page load and save. `toFormState` carries the specific
    // message rather than a generic failure, so the driver understands that
    // their work was not lost to a bug.
    return toFormState(error, 'updateServiceAction', toEchoValues(formData));
  }

  revalidatePath('/driver');
  revalidatePath('/services');
  revalidatePath('/admin');
  revalidatePath('/admin/services');
  revalidatePath(`/services/${serviceId}`);
  revalidatePath(`/admin/services/${serviceId}`);

  redirect(
    returnTo === 'admin'
      ? `/admin/services/${serviceId}?updated=1`
      : `/services/${serviceId}?updated=1`,
  );
}
