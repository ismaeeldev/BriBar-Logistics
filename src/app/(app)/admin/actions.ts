'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdmin } from '@/lib/auth/session';
import { isAppError } from '@/lib/errors/app-error';
import { toFieldErrors } from '@/lib/http/api-response';
import { ERRORS } from '@/lib/i18n/messages';
import { logger } from '@/lib/logger';
import { clientService } from '@/modules/clients/service/client.service';
import { createClientSchema, updateClientSchema } from '@/modules/clients/schemas/client.schema';
import { configService } from '@/modules/config/service/config.service';
import { updateConfigSchema } from '@/modules/config/schemas/config.schema';
import { lookupService } from '@/modules/lookup/service/lookup.service';
import { createLookupItemSchema, updateLookupItemSchema } from '@/modules/lookup/schemas/lookup.schema';
import type { LookupKind } from '@/modules/lookup/repository/lookup.repository';
import { refuellingService } from '@/modules/refuelling/service/refuelling.service';
import {
  createRefuellingSchema,
  updateRefuellingSchema,
} from '@/modules/refuelling/schemas/refuelling.schema';
import { supplierService } from '@/modules/suppliers/service/supplier.service';
import {
  createSupplierSchema,
  updateSupplierSchema,
} from '@/modules/suppliers/schemas/supplier.schema';
import { expenseCategoryService } from '@/modules/expense-categories/service/expense-category.service';
import {
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
} from '@/modules/expense-categories/schemas/expense-category.schema';
import { receivedInvoiceService } from '@/modules/received-invoices/service/received-invoice.service';
import {
  createReceivedInvoiceSchema,
  updateReceivedInvoiceSchema,
} from '@/modules/received-invoices/schemas/received-invoice.schema';
import { issuedInvoiceService } from '@/modules/issued-invoices/service/issued-invoice.service';
import {
  createIssuedInvoiceSchema,
  updateIssuedInvoiceSchema,
} from '@/modules/issued-invoices/schemas/issued-invoice.schema';
import { createRouteSchema, updateRouteSchema } from '@/modules/routes/schemas/route.schema';
import { routeService } from '@/modules/routes/service/route.service';
import { dailyKmLogService } from '@/modules/daily-km/service/daily-km-log.service';
import {
  createDailyKmLogSchema,
  updateDailyKmLogSchema,
} from '@/modules/daily-km/schemas/daily-km-log.schema';
import { personnelCostService } from '@/modules/personnel/service/personnel-cost.service';
import {
  createPersonnelCostSchema,
  updatePersonnelCostSchema,
} from '@/modules/personnel/schemas/personnel-cost.schema';
import { maintenanceRecordService } from '@/modules/maintenance/service/maintenance-record.service';
import {
  createMaintenanceRecordSchema,
  updateMaintenanceRecordSchema,
} from '@/modules/maintenance/schemas/maintenance-record.schema';
import {
  updateServiceRateSchema,
  updateServiceSupplementSchema,
} from '@/modules/services/schemas/service.schema';
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

/**
 * Sets or clears a service's supplement (ERP roadmap Phase 4) — same shape
 * as `updateServiceRateAction`.
 */
export async function updateServiceSupplementAction(
  serviceId: string,
  supplementInput: string,
  supplementTypeIdInput: string,
): Promise<void> {
  const actor = await requireAdmin();

  const parsed = updateServiceSupplementSchema.safeParse({
    supplement: supplementInput,
    supplementTypeId: supplementTypeIdInput,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? ERRORS.validationFailed);
  }

  await serviceService.updateSupplement(actor, serviceId, {
    supplementCents: parsed.data.supplement ?? null,
    supplementTypeId: parsed.data.supplementTypeId,
  });

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
// Clients (ERP roadmap Phase 1)
// ---------------------------------------------------------------------------

export async function createClientAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = createClientSchema.safeParse({
      name: text(formData, 'name'),
      taxId: text(formData, 'taxId'),
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

    await clientService.create(actor, parsed.data);
  } catch (error) {
    return toFormState(error, 'createClientAction', echo(formData));
  }

  revalidatePath('/admin/clients');
  redirect('/admin/clients?created=1');
}

export async function updateClientAction(
  clientId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = updateClientSchema.safeParse({
      name: text(formData, 'name'),
      taxId: text(formData, 'taxId'),
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

    await clientService.update(actor, clientId, parsed.data);
  } catch (error) {
    return toFormState(error, 'updateClientAction', echo(formData));
  }

  revalidatePath('/admin/clients');
  redirect('/admin/clients?updated=1');
}

// ---------------------------------------------------------------------------
// Simple lookup lists (ERP roadmap Phase 1) — fuel types, payment methods,
// supplement types, end clients. One action per verb, parameterised by
// `kind`, rather than one per kind: the four lists are identical in shape, so
// a fifth would be a new enum value and a route segment, not new code here.
// ---------------------------------------------------------------------------

export async function createLookupItemAction(
  kind: LookupKind,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = createLookupItemSchema.safeParse({
      name: text(formData, 'name'),
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

    await lookupService.create(actor, kind, parsed.data);
  } catch (error) {
    return toFormState(error, 'createLookupItemAction', echo(formData));
  }

  revalidatePath(`/admin/lists/${kind}`);
  redirect(`/admin/lists/${kind}?created=1`);
}

export async function updateLookupItemAction(
  kind: LookupKind,
  itemId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = updateLookupItemSchema.safeParse({
      name: text(formData, 'name'),
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

    await lookupService.update(actor, kind, itemId, parsed.data);
  } catch (error) {
    return toFormState(error, 'updateLookupItemAction', echo(formData));
  }

  revalidatePath(`/admin/lists/${kind}`);
  redirect(`/admin/lists/${kind}?updated=1`);
}

// ---------------------------------------------------------------------------
// Operational defaults (ERP roadmap Phase 1, `99_Config`)
// ---------------------------------------------------------------------------

export async function updateConfigAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = updateConfigSchema.safeParse({
      oilChangeIntervalKm: text(formData, 'oilChangeIntervalKm'),
      defaultConsumption: text(formData, 'defaultConsumption'),
      defaultFuelPrice: text(formData, 'defaultFuelPrice'),
    });

    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: echo(formData),
      };
    }

    await configService.update(actor, parsed.data);
  } catch (error) {
    return toFormState(error, 'updateConfigAction', echo(formData));
  }

  revalidatePath('/admin/config');
  redirect('/admin/config?updated=1');
}

// ---------------------------------------------------------------------------
// Refuelling (ERP roadmap Phase 2)
// ---------------------------------------------------------------------------

function refuellingFields(formData: FormData) {
  return {
    vehicleId: text(formData, 'vehicleId'),
    driverId: text(formData, 'driverId'),
    odometerKm: text(formData, 'odometerKm'),
    liters: text(formData, 'liters'),
    total: text(formData, 'total'),
    vatRate: text(formData, 'vatRate'),
    fuelTypeId: text(formData, 'fuelTypeId'),
    gasStationId: text(formData, 'gasStationId'),
    paymentMethodId: text(formData, 'paymentMethodId'),
    notes: text(formData, 'notes'),
  };
}

export async function createRefuellingAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = createRefuellingSchema.safeParse(refuellingFields(formData));
    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: echo(formData),
      };
    }

    await refuellingService.create(actor, parsed.data);
  } catch (error) {
    return toFormState(error, 'createRefuellingAction', echo(formData));
  }

  revalidatePath('/admin/refuellings');
  redirect('/admin/refuellings?created=1');
}

export async function updateRefuellingAction(
  refuellingId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = updateRefuellingSchema.safeParse(refuellingFields(formData));
    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: echo(formData),
      };
    }

    await refuellingService.update(actor, refuellingId, parsed.data);
  } catch (error) {
    return toFormState(error, 'updateRefuellingAction', echo(formData));
  }

  revalidatePath('/admin/refuellings');
  revalidatePath(`/admin/refuellings/${refuellingId}`);
  redirect(`/admin/refuellings/${refuellingId}?updated=1`);
}

// ---------------------------------------------------------------------------
// Daily km logs (ERP roadmap Phase 5)
// ---------------------------------------------------------------------------

function dailyKmLogFields(formData: FormData) {
  return {
    vehicleId: text(formData, 'vehicleId'),
    routeId: text(formData, 'routeId'),
    driverId: text(formData, 'driverId'),
    date: text(formData, 'date'),
    actualKm: text(formData, 'actualKm'),
    workedHours: text(formData, 'workedHours'),
    notes: text(formData, 'notes'),
  };
}

export async function createDailyKmLogAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = createDailyKmLogSchema.safeParse(dailyKmLogFields(formData));
    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: echo(formData),
      };
    }

    await dailyKmLogService.create(actor, parsed.data);
  } catch (error) {
    return toFormState(error, 'createDailyKmLogAction', echo(formData));
  }

  revalidatePath('/admin/daily-km');
  redirect('/admin/daily-km?created=1');
}

export async function updateDailyKmLogAction(
  dailyKmLogId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = updateDailyKmLogSchema.safeParse(dailyKmLogFields(formData));
    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: echo(formData),
      };
    }

    await dailyKmLogService.update(actor, dailyKmLogId, parsed.data);
  } catch (error) {
    return toFormState(error, 'updateDailyKmLogAction', echo(formData));
  }

  revalidatePath('/admin/daily-km');
  revalidatePath(`/admin/daily-km/${dailyKmLogId}`);
  redirect(`/admin/daily-km/${dailyKmLogId}?updated=1`);
}

// ---------------------------------------------------------------------------
// Personnel costs (ERP roadmap Phase 5)
// ---------------------------------------------------------------------------

function personnelCostFields(formData: FormData) {
  return {
    userId: text(formData, 'userId'),
    year: text(formData, 'year'),
    month: text(formData, 'month'),
    base: text(formData, 'base'),
    overtime: text(formData, 'overtime'),
    allowances: text(formData, 'allowances'),
    other: text(formData, 'other'),
    notes: text(formData, 'notes'),
  };
}

export async function createPersonnelCostAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = createPersonnelCostSchema.safeParse(personnelCostFields(formData));
    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: echo(formData),
      };
    }

    await personnelCostService.create(actor, parsed.data);
  } catch (error) {
    return toFormState(error, 'createPersonnelCostAction', echo(formData));
  }

  revalidatePath('/admin/personnel');
  redirect('/admin/personnel?created=1');
}

export async function updatePersonnelCostAction(
  personnelCostId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = updatePersonnelCostSchema.safeParse(personnelCostFields(formData));
    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: echo(formData),
      };
    }

    await personnelCostService.update(actor, personnelCostId, parsed.data);
  } catch (error) {
    return toFormState(error, 'updatePersonnelCostAction', echo(formData));
  }

  revalidatePath('/admin/personnel');
  revalidatePath(`/admin/personnel/${personnelCostId}`);
  redirect(`/admin/personnel/${personnelCostId}?updated=1`);
}

// ---------------------------------------------------------------------------
// Maintenance records (ERP roadmap Phase 5)
// ---------------------------------------------------------------------------

function maintenanceRecordFields(formData: FormData) {
  return {
    vehicleId: text(formData, 'vehicleId'),
    maintenanceTypeId: text(formData, 'maintenanceTypeId'),
    performedDate: text(formData, 'performedDate'),
    performedKm: text(formData, 'performedKm'),
    nextDueKm: text(formData, 'nextDueKm'),
    nextDueDate: text(formData, 'nextDueDate'),
    notes: text(formData, 'notes'),
  };
}

export async function createMaintenanceRecordAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = createMaintenanceRecordSchema.safeParse(maintenanceRecordFields(formData));
    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: echo(formData),
      };
    }

    await maintenanceRecordService.create(actor, parsed.data);
  } catch (error) {
    return toFormState(error, 'createMaintenanceRecordAction', echo(formData));
  }

  revalidatePath('/admin/maintenance');
  redirect('/admin/maintenance?created=1');
}

export async function updateMaintenanceRecordAction(
  maintenanceRecordId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = updateMaintenanceRecordSchema.safeParse(maintenanceRecordFields(formData));
    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: echo(formData),
      };
    }

    await maintenanceRecordService.update(actor, maintenanceRecordId, parsed.data);
  } catch (error) {
    return toFormState(error, 'updateMaintenanceRecordAction', echo(formData));
  }

  revalidatePath('/admin/maintenance');
  revalidatePath(`/admin/maintenance/${maintenanceRecordId}`);
  redirect(`/admin/maintenance/${maintenanceRecordId}?updated=1`);
}

// ---------------------------------------------------------------------------
// Suppliers (ERP roadmap Phase 3)
// ---------------------------------------------------------------------------

export async function createSupplierAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = createSupplierSchema.safeParse({
      name: text(formData, 'name'),
      taxId: text(formData, 'taxId'),
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

    await supplierService.create(actor, parsed.data);
  } catch (error) {
    return toFormState(error, 'createSupplierAction', echo(formData));
  }

  revalidatePath('/admin/suppliers');
  redirect('/admin/suppliers?created=1');
}

export async function updateSupplierAction(
  supplierId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = updateSupplierSchema.safeParse({
      name: text(formData, 'name'),
      taxId: text(formData, 'taxId'),
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

    await supplierService.update(actor, supplierId, parsed.data);
  } catch (error) {
    return toFormState(error, 'updateSupplierAction', echo(formData));
  }

  revalidatePath('/admin/suppliers');
  redirect('/admin/suppliers?updated=1');
}

// ---------------------------------------------------------------------------
// Expense categories (ERP roadmap Phase 3)
// ---------------------------------------------------------------------------

export async function createExpenseCategoryAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = createExpenseCategorySchema.safeParse({
      name: text(formData, 'name'),
      expenseType: text(formData, 'expenseType'),
      defaultVatRate: text(formData, 'defaultVatRate'),
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

    await expenseCategoryService.create(actor, parsed.data);
  } catch (error) {
    return toFormState(error, 'createExpenseCategoryAction', echo(formData));
  }

  revalidatePath('/admin/expense-categories');
  redirect('/admin/expense-categories?created=1');
}

export async function updateExpenseCategoryAction(
  categoryId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = updateExpenseCategorySchema.safeParse({
      name: text(formData, 'name'),
      expenseType: text(formData, 'expenseType'),
      defaultVatRate: text(formData, 'defaultVatRate'),
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

    await expenseCategoryService.update(actor, categoryId, parsed.data);
  } catch (error) {
    return toFormState(error, 'updateExpenseCategoryAction', echo(formData));
  }

  revalidatePath('/admin/expense-categories');
  redirect('/admin/expense-categories?updated=1');
}

// ---------------------------------------------------------------------------
// Received invoices (ERP roadmap Phase 3)
// ---------------------------------------------------------------------------

function receivedInvoiceFields(formData: FormData) {
  return {
    supplierId: text(formData, 'supplierId'),
    categoryId: text(formData, 'categoryId'),
    vehicleId: text(formData, 'vehicleId'),
    invoiceDate: text(formData, 'invoiceDate'),
    base: text(formData, 'base'),
    vatRate: text(formData, 'vatRate'),
    stateId: text(formData, 'stateId'),
    paymentMethodId: text(formData, 'paymentMethodId'),
    notes: text(formData, 'notes'),
  };
}

export async function createReceivedInvoiceAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = createReceivedInvoiceSchema.safeParse(receivedInvoiceFields(formData));
    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: echo(formData),
      };
    }

    await receivedInvoiceService.create(actor, parsed.data);
  } catch (error) {
    return toFormState(error, 'createReceivedInvoiceAction', echo(formData));
  }

  revalidatePath('/admin/received-invoices');
  revalidatePath('/admin/investments');
  redirect('/admin/received-invoices?created=1');
}

export async function updateReceivedInvoiceAction(
  invoiceId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = updateReceivedInvoiceSchema.safeParse(receivedInvoiceFields(formData));
    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: echo(formData),
      };
    }

    await receivedInvoiceService.update(actor, invoiceId, parsed.data);
  } catch (error) {
    return toFormState(error, 'updateReceivedInvoiceAction', echo(formData));
  }

  revalidatePath('/admin/received-invoices');
  revalidatePath(`/admin/received-invoices/${invoiceId}`);
  revalidatePath('/admin/investments');
  redirect(`/admin/received-invoices/${invoiceId}?updated=1`);
}

// ---------------------------------------------------------------------------
// Issued invoices (ERP roadmap Phase 4)
// ---------------------------------------------------------------------------

export async function createIssuedInvoiceAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  let createdId: string;
  try {
    const actor = await requireAdmin();

    const parsed = createIssuedInvoiceSchema.safeParse({
      clientId: text(formData, 'clientId'),
      invoiceDate: text(formData, 'invoiceDate'),
      vatRate: text(formData, 'vatRate'),
      // A checkbox list, not a single field - every checked service submits
      // its own `serviceIds` entry.
      serviceIds: formData.getAll('serviceIds'),
      stateId: text(formData, 'stateId'),
      notes: text(formData, 'notes'),
    });

    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: echo(formData),
      };
    }

    const created = await issuedInvoiceService.create(actor, parsed.data);
    createdId = created.id;
  } catch (error) {
    return toFormState(error, 'createIssuedInvoiceAction', echo(formData));
  }

  // Every service the invoice grouped moves from "billable" to "billed", so
  // the admin services list (which shows billing status) and the picker
  // this action's own form reads from both need to see the change.
  revalidatePath('/admin/issued-invoices');
  revalidatePath('/admin/services');
  redirect(`/admin/issued-invoices/${createdId}?created=1`);
}

export async function updateIssuedInvoiceAction(
  invoiceId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireAdmin();

    const parsed = updateIssuedInvoiceSchema.safeParse({
      stateId: text(formData, 'stateId'),
      notes: text(formData, 'notes'),
    });

    if (!parsed.success) {
      return {
        status: 'error',
        message: ERRORS.validationFailed,
        fieldErrors: toFieldErrors(parsed.error),
        values: echo(formData),
      };
    }

    await issuedInvoiceService.update(actor, invoiceId, parsed.data);
  } catch (error) {
    return toFormState(error, 'updateIssuedInvoiceAction', echo(formData));
  }

  revalidatePath('/admin/issued-invoices');
  revalidatePath(`/admin/issued-invoices/${invoiceId}`);
  redirect(`/admin/issued-invoices/${invoiceId}?updated=1`);
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
      clientId: text(formData, 'clientId'),
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
      clientId: text(formData, 'clientId'),
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

export async function deleteClientAction(
  clientId: string,
  _state: DeleteState,
): Promise<DeleteState> {
  try {
    const actor = await requireAdmin();
    await clientService.remove(actor, clientId);
  } catch (error) {
    return toDeleteState(error, 'deleteClientAction');
  }

  revalidatePath('/admin/clients');
  redirect('/admin/clients?deleted=1');
}

export async function deleteLookupItemAction(
  kind: LookupKind,
  itemId: string,
  _state: DeleteState,
): Promise<DeleteState> {
  try {
    const actor = await requireAdmin();
    await lookupService.remove(actor, kind, itemId);
  } catch (error) {
    return toDeleteState(error, 'deleteLookupItemAction');
  }

  revalidatePath(`/admin/lists/${kind}`);
  redirect(`/admin/lists/${kind}?deleted=1`);
}

export async function deleteRefuellingAction(
  refuellingId: string,
  _state: DeleteState,
): Promise<DeleteState> {
  try {
    const actor = await requireAdmin();
    await refuellingService.remove(actor, refuellingId);
  } catch (error) {
    return toDeleteState(error, 'deleteRefuellingAction');
  }

  revalidatePath('/admin/refuellings');
  redirect('/admin/refuellings?deleted=1');
}

export async function deleteDailyKmLogAction(
  dailyKmLogId: string,
  _state: DeleteState,
): Promise<DeleteState> {
  try {
    const actor = await requireAdmin();
    await dailyKmLogService.remove(actor, dailyKmLogId);
  } catch (error) {
    return toDeleteState(error, 'deleteDailyKmLogAction');
  }

  revalidatePath('/admin/daily-km');
  redirect('/admin/daily-km?deleted=1');
}

export async function deletePersonnelCostAction(
  personnelCostId: string,
  _state: DeleteState,
): Promise<DeleteState> {
  try {
    const actor = await requireAdmin();
    await personnelCostService.remove(actor, personnelCostId);
  } catch (error) {
    return toDeleteState(error, 'deletePersonnelCostAction');
  }

  revalidatePath('/admin/personnel');
  redirect('/admin/personnel?deleted=1');
}

export async function deleteMaintenanceRecordAction(
  maintenanceRecordId: string,
  _state: DeleteState,
): Promise<DeleteState> {
  try {
    const actor = await requireAdmin();
    await maintenanceRecordService.remove(actor, maintenanceRecordId);
  } catch (error) {
    return toDeleteState(error, 'deleteMaintenanceRecordAction');
  }

  revalidatePath('/admin/maintenance');
  redirect('/admin/maintenance?deleted=1');
}

export async function deleteSupplierAction(
  supplierId: string,
  _state: DeleteState,
): Promise<DeleteState> {
  try {
    const actor = await requireAdmin();
    await supplierService.remove(actor, supplierId);
  } catch (error) {
    return toDeleteState(error, 'deleteSupplierAction');
  }

  revalidatePath('/admin/suppliers');
  redirect('/admin/suppliers?deleted=1');
}

export async function deleteExpenseCategoryAction(
  categoryId: string,
  _state: DeleteState,
): Promise<DeleteState> {
  try {
    const actor = await requireAdmin();
    await expenseCategoryService.remove(actor, categoryId);
  } catch (error) {
    return toDeleteState(error, 'deleteExpenseCategoryAction');
  }

  revalidatePath('/admin/expense-categories');
  redirect('/admin/expense-categories?deleted=1');
}

export async function deleteReceivedInvoiceAction(
  invoiceId: string,
  _state: DeleteState,
): Promise<DeleteState> {
  try {
    const actor = await requireAdmin();
    await receivedInvoiceService.remove(actor, invoiceId);
  } catch (error) {
    return toDeleteState(error, 'deleteReceivedInvoiceAction');
  }

  revalidatePath('/admin/received-invoices');
  revalidatePath('/admin/investments');
  redirect('/admin/received-invoices?deleted=1');
}

export async function deleteIssuedInvoiceAction(
  invoiceId: string,
  _state: DeleteState,
): Promise<DeleteState> {
  try {
    const actor = await requireAdmin();
    await issuedInvoiceService.remove(actor, invoiceId);
  } catch (error) {
    return toDeleteState(error, 'deleteIssuedInvoiceAction');
  }

  // Deleting the invoice frees every service it grouped back to "billable".
  revalidatePath('/admin/issued-invoices');
  revalidatePath('/admin/services');
  redirect('/admin/issued-invoices?deleted=1');
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
