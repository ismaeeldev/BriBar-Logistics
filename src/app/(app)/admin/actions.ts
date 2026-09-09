'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdmin } from '@/lib/auth/session';
import { isAppError } from '@/lib/errors/app-error';
import { toFieldErrors } from '@/lib/http/api-response';
import { ERRORS } from '@/lib/i18n/messages';
import { logger } from '@/lib/logger';
import { createRouteSchema, updateRouteSchema } from '@/modules/routes/schemas/route.schema';
import { routeService } from '@/modules/routes/service/route.service';
import { updateServiceRateSchema } from '@/modules/services/schemas/service.schema';
import { serviceService } from '@/modules/services/service/service.service';
import {
  createUserSchema,
  replaceRouteAssignmentsSchema,
  updateUserSchema,
} from '@/modules/users/schemas/user.schema';
import { userService } from '@/modules/users/service/user.service';
import {
  createVehicleSchema,
  updateVehicleSchema,
} from '@/modules/vehicles/schemas/vehicle.schema';
import { vehicleService } from '@/modules/vehicles/service/vehicle.service';

/**
 * Server actions for the admin screens.
 *
 * Thin by design. Each one authorises, parses with the same schema the API
 * route uses, calls the same service function, and translates the outcome for
 * a form. No business rule appears here that is not also enforced for an API
 * caller — `requireAdmin` and the service layer's own `assertAdmin` both run,
 * so a missing check in one place cannot open a hole.
 */

export type FormState =
  | { status: 'idle' }
  | {
      status: 'error';
      message?: string;
      fieldErrors?: Record<string, string[]>;
      /** Echoed back so a failed submission does not lose input (SRS 24.1). */
      values?: Record<string, string>;
    };

/** Every string field on the form, for repopulating it after a failure. */
function echo(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && !key.startsWith('$')) values[key] = value;
  }
  return values;
}

function toFormState(
  error: unknown,
  context: string,
  values: Record<string, string>,
): FormState {
  if (isAppError(error)) {
    return {
      status: 'error',
      message: error.message,
      values,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    };
  }

  logger.error(`Unhandled error in ${context}`, error);
  return { status: 'error', message: ERRORS.internal, values };
}

/** `formData.get` returns null for an unchecked box; the schemas want a boolean. */
function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) !== null;
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

// ---------------------------------------------------------------------------
// Services (SRS 11.3, 16.4)
// ---------------------------------------------------------------------------

/**
 * Approves a pending service.
 *
 * No form state: the only outcomes are success, or a conflict because someone
 * else approved it first. Both are best expressed by re-rendering the detail
 * page, which shows the current status either way.
 */
export async function approveServiceAction(serviceId: string): Promise<void> {
  const actor = await requireAdmin();
  await serviceService.approve(actor, serviceId);

  revalidatePath('/admin');
  revalidatePath('/admin/services');
  revalidatePath(`/admin/services/${serviceId}`);
}

/**
 * Sets or clears a service's rate (client change request 2026-09-09, ERP
 * roadmap Phase 0).
 *
 * Deliberately its own action rather than a field on the general edit form:
 * this is admin-only information a driver's schema has no field for, and the
 * caller here is the review screen's inline editor, not a `<form>` with
 * `useActionState` — so, like `approveServiceAction`, it throws on failure
 * (read as `.message` by the client component) instead of returning form
 * state.
 */
export async function updateServiceRateAction(serviceId: string, rateInput: string): Promise<void> {
  const actor = await requireAdmin();

  const parsed = updateServiceRateSchema.safeParse({ rate: rateInput });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? ERRORS.validationFailed);
  }

  await serviceService.updateRate(actor, serviceId, parsed.data.rate ?? null);

  revalidatePath('/admin/services');
  revalidatePath(`/admin/services/${serviceId}`);
}

// ---------------------------------------------------------------------------
// Vehicles (SRS 13)
// ---------------------------------------------------------------------------

export async function createVehicleAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = createVehicleSchema.safeParse({
      registrationPlate: text(formData, 'registrationPlate'),
      referenceName: text(formData, 'referenceName'),
      isActive: checkbox(formData, 'isActive'),
    });

    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: echo(formData),
      };
    }

    await vehicleService.create(actor, parsed.data);
  } catch (error) {
    return toFormState(error, 'createVehicleAction', echo(formData));
  }

  revalidatePath('/admin/vehicles');
  redirect('/admin/vehicles?created=1');
}

export async function updateVehicleAction(
  vehicleId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = updateVehicleSchema.safeParse({
      registrationPlate: text(formData, 'registrationPlate'),
      referenceName: text(formData, 'referenceName'),
      isActive: checkbox(formData, 'isActive'),
    });

    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: echo(formData),
      };
    }

    await vehicleService.update(actor, vehicleId, parsed.data);
  } catch (error) {
    return toFormState(error, 'updateVehicleAction', echo(formData));
  }

  revalidatePath('/admin/vehicles');
  redirect('/admin/vehicles?updated=1');
}

// ---------------------------------------------------------------------------
// Routes (SRS 14)
// ---------------------------------------------------------------------------

export async function createRouteAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = createRouteSchema.safeParse({
      code: text(formData, 'code'),
      name: text(formData, 'name'),
      origin: text(formData, 'origin'),
      destination: text(formData, 'destination'),
      isActive: checkbox(formData, 'isActive'),
      defaultRate: text(formData, 'defaultRate'),
    });

    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: echo(formData),
      };
    }

    await routeService.create(actor, parsed.data);
  } catch (error) {
    return toFormState(error, 'createRouteAction', echo(formData));
  }

  revalidatePath('/admin/routes');
  redirect('/admin/routes?created=1');
}

export async function updateRouteAction(
  routeId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = updateRouteSchema.safeParse({
      code: text(formData, 'code'),
      name: text(formData, 'name'),
      origin: text(formData, 'origin'),
      destination: text(formData, 'destination'),
      isActive: checkbox(formData, 'isActive'),
      defaultRate: text(formData, 'defaultRate'),
    });

    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: echo(formData),
      };
    }

    await routeService.update(actor, routeId, parsed.data);
  } catch (error) {
    return toFormState(error, 'updateRouteAction', echo(formData));
  }

  // Editing origin/destination changes what *future* services snapshot, so the
  // Add Service context is stale for every driver holding this route.
  revalidatePath('/admin/routes');
  revalidatePath('/services/new');
  redirect('/admin/routes?updated=1');
}

// ---------------------------------------------------------------------------
// Users (SRS 12)
// ---------------------------------------------------------------------------

/**
 * Reads the route-assignment controls.
 *
 * The form submits one checkbox per route (`route:<id>`) and a single radio for
 * the default (`defaultRouteId`). A route marked default but not checked is
 * treated as assigned — unchecking the box while leaving the radio selected is
 * a slip, not an instruction to drop the route.
 */
function readAssignments(formData: FormData): { routeId: string; isDefault: boolean }[] {
  const defaultRouteId = text(formData, 'defaultRouteId');
  const assigned = new Set<string>();

  for (const [key, value] of formData.entries()) {
    if (key.startsWith('route:') && value === 'on') assigned.add(key.slice('route:'.length));
  }
  if (defaultRouteId) assigned.add(defaultRouteId);

  return [...assigned].map((routeId) => ({ routeId, isDefault: routeId === defaultRouteId }));
}

export async function createUserAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();
    const role = text(formData, 'role');
    const defaultVehicleId = text(formData, 'defaultVehicleId');

    const parsed = createUserSchema.safeParse({
      name: text(formData, 'name'),
      loginIdentifier: text(formData, 'loginIdentifier'),
      password: text(formData, 'password'),
      role,
      isActive: checkbox(formData, 'isActive'),
      // An administrator has neither (SRS 3.2), and the schema rejects both —
      // so they are omitted rather than sent as empty values.
      ...(role === 'DRIVER' && defaultVehicleId ? { defaultVehicleId } : {}),
      assignments: role === 'DRIVER' ? readAssignments(formData) : [],
    });

    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: echo(formData),
      };
    }

    await userService.create(actor, parsed.data);
  } catch (error) {
    return toFormState(error, 'createUserAction', echo(formData));
  }

  revalidatePath('/admin/users');
  redirect('/admin/users?created=1');
}

/**
 * Edits an account and replaces its route assignments in one submission.
 *
 * Two service calls rather than one, because SRS 18.4 models them as separate
 * endpoints and each writes its own audit entry — a role change and a route
 * change are different events and should read as such in the log.
 *
 * The password field is only sent when the administrator typed one; an empty
 * box leaves the existing hash alone (`docs/open-questions.md` #5).
 */
export async function updateUserAction(
  userId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();
    const role = text(formData, 'role');
    const password = text(formData, 'password');
    const defaultVehicleId = text(formData, 'defaultVehicleId');

    const parsed = updateUserSchema.safeParse({
      name: text(formData, 'name'),
      loginIdentifier: text(formData, 'loginIdentifier'),
      role,
      isActive: checkbox(formData, 'isActive'),
      ...(password ? { password } : {}),
      // `null` clears the default vehicle; absent would leave it unchanged.
      ...(role === 'DRIVER' ? { defaultVehicleId: defaultVehicleId || null } : {}),
    });

    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: echo(formData),
      };
    }

    await userService.update(actor, userId, parsed.data);

    if (role === 'DRIVER') {
      const assignments = replaceRouteAssignmentsSchema.safeParse({
        assignments: readAssignments(formData),
      });

      if (!assignments.success) {
        return {
          status: 'error',
          message: ERRORS.validationFailed,
          fieldErrors: toFieldErrors(assignments.error),
          values: echo(formData),
        };
      }

      await userService.replaceRouteAssignments(actor, userId, assignments.data);
    }
  } catch (error) {
    return toFormState(error, 'updateUserAction', echo(formData));
  }

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
  redirect('/admin/users?updated=1');
}

// ---------------------------------------------------------------------------
// Deleting master data
//
// One action per entity rather than one generic action taking an entity name:
// a `deleteAction('user', id)` would be a single endpoint that deletes anything
// by string, and the type system would stop checking which service it reaches.
// ---------------------------------------------------------------------------

/**
 * The outcome of a delete attempt.
 *
 * Deletion redirects on success, so the only state a form ever renders is a
 * failure — a record that acquired a dependent between the page render and the
 * click, or a foreign key the application layer did not anticipate.
 */
export type DeleteState = { status: 'idle' } | { status: 'error'; message: string };

function toDeleteState(error: unknown, context: string): DeleteState {
  if (isAppError(error)) return { status: 'error', message: error.message };
  logger.error(`${context} failed`, { error });
  return { status: 'error', message: ERRORS.internal };
}

export async function deleteVehicleAction(
  vehicleId: string,
  _state: DeleteState,
): Promise<DeleteState> {
  try {
    const actor = await requireAdmin();
    await vehicleService.remove(actor, vehicleId);
  } catch (error) {
    return toDeleteState(error, 'deleteVehicleAction');
  }

  revalidatePath('/admin/vehicles');
  redirect('/admin/vehicles?deleted=1');
}

export async function deleteRouteAction(
  routeId: string,
  _state: DeleteState,
): Promise<DeleteState> {
  try {
    const actor = await requireAdmin();
    await routeService.remove(actor, routeId);
  } catch (error) {
    return toDeleteState(error, 'deleteRouteAction');
  }

  revalidatePath('/admin/routes');
  redirect('/admin/routes?deleted=1');
}

export async function deleteUserAction(
  userId: string,
  _state: DeleteState,
): Promise<DeleteState> {
  try {
    const actor = await requireAdmin();
    await userService.remove(actor, userId);
  } catch (error) {
    return toDeleteState(error, 'deleteUserAction');
  }

  revalidatePath('/admin/users');
  redirect('/admin/users?deleted=1');
}
